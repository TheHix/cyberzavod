import { describe, expect, it } from "vitest";
import type { Draft, DraftEvent, DraftMessage } from "./draft.ts";
import type { RawEvent } from "./raw-event.ts";
import {
  isHumanPrompt,
  routeMessages,
  runTranscriptPaths,
  sessionTranscriptPath,
  sessionTranscriptPaths,
  stationTranscriptPaths,
  toDraft,
  toolDirectories,
} from "./to-draft.ts";
import type { AgentAssignment, AgentReport, TranscriptText } from "./transcript.ts";

const START = 1_000_000;

function typicalSession(): RawEvent[] {
  return [
    { ts: START, kind: "session_start" },
    { ts: START + 1_000, kind: "prompt", text: "Добавь счётчик токенов" },
    { ts: START + 5_000, kind: "tool", tool: "Read", ok: true, file: "/a.ts" },
    { ts: START + 9_000, kind: "tool", tool: "Edit", ok: true, file: "/a.ts" },
    { ts: START + 12_000, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
    { ts: START + 15_000, kind: "tool", tool: "Edit", ok: true, file: "/a.ts" },
    {
      ts: START + 18_000,
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "make check-web check-api",
    },
    { ts: START + 20_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
    { ts: START + 40_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
    {
      ts: START + 42_000,
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "git commit -m 'feat: …'",
    },
    { ts: START + 45_000, kind: "stop" },
  ];
}

// Исходы проверок по порядку: у вердикта станции — с запуском, у запуска проверок — без.
function checksOf(events: DraftEvent[]) {
  return events.flatMap((event) =>
    event.type === "draft_check"
      ? [{ ok: event.ok, ...(event.run === undefined ? {} : { run: event.run }) }]
      : [],
  );
}

function stagesOf(events: DraftEvent[]): string[] {
  return events.flatMap((event) => {
    if (event.type === "stage_enter") return [event.stage];
    if (event.type === "stage_fail") return [`fail:${event.stage}`];
    return [];
  });
}

describe("toDraft", () => {
  it("проводит типичную сессию по этапам код → проверки → код → проверки → ревью → выпуск", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual([
      "code",
      "test",
      "fail:test",
      "code",
      "test",
      "review",
      "ship",
    ]);
  });

  it("отсчитывает время событий от начала сессии", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect([draft.events[0]?.t, draft.events.at(-1)?.t]).toEqual([1_000, 42_000]);
  });

  it("не пишет начало и конец сборки: их ставит публикация", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events.filter((e) => e.type === "build_start" || e.type === "build_end")).toEqual(
      [],
    );
  });

  it("кладёт промпт как есть, а заголовок и чистовую версию оставляет редактору", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect({ title: draft.builds[0]?.title, prompt: draft.events[0] }).toEqual({
      title: "",
      prompt: {
        t: 1_000,
        type: "draft_prompt",
        said: "Добавь счётчик токенов",
        goal: "",
        requirements: [],
      },
    });
  });

  it("собирает id из дня начала сессии по UTC и начала её id", () => {
    const startTs = Date.UTC(2026, 9, 4, 23, 30);
    const raw: RawEvent[] = [{ ts: startTs, kind: "session_start" }];

    const draft = toDraft(raw, { sessionId: "744e7547-d312-42c4" });

    expect({ id: draft.id, startedAt: draft.startedAt }).toEqual({
      id: "2026-10-04-744e7547",
      startedAt: "2026-10-04T23:30:00.000Z",
    });
  });

  it("берёт проект и версию завода из начала сессии", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start", project: "cyberzavod", factory: "0.1.0" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.builds[0]).toMatchObject({ project: "cyberzavod", factory: "0.1.0" });
  });

  it("собирает одну сборку с id черновика и без запусков", () => {
    const raw: RawEvent[] = [{ ts: START, kind: "session_start" }];

    const draft = toDraft(raw, { sessionId: "744e7547-d312" });

    expect(draft.builds).toEqual([{ id: draft.id, project: "", factory: "", title: "", runs: [] }]);
  });

  it("оставляет проект и версию завода пустыми, если в журнале их нет", () => {
    const raw: RawEvent[] = [{ ts: START, kind: "session_start" }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.builds[0]).toMatchObject({ project: "", factory: "" });
  });

  it("берёт проект из первого начала сессии, где он есть", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 1_000, kind: "session_start", project: "cyberzavod", factory: "0.1.0" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.builds[0]).toMatchObject({ project: "cyberzavod", factory: "0.1.0" });
  });

  it("пишет исход каждого запуска проверок в основной сессии без запуска станции", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "почини" },
      { ts: START + 1_000, kind: "tool", tool: "Bash", ok: false, command: "go test ./..." },
      { ts: START + 2_000, kind: "tool", tool: "Bash", ok: true, command: "make check-web" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(checksOf(draft.events)).toEqual([{ ok: false }, { ok: true }]);
  });

  it("сортирует события не по порядку", () => {
    const raw = typicalSession().reverse();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events[0]?.type).toBe("draft_prompt");
  });

  it("не возвращает сборку на этап тестов из-за проверок внутри ревью", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 2_000, kind: "tool", tool: "Bash", ok: false, command: "make check" },
      { ts: START + 3_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
      { ts: START + 4_000, kind: "tool", tool: "Bash", ok: true, command: "git commit -m x" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code", "review", "ship"]);
  });

  it("не закрывает окно ревьюера остановкой служебного сабагента без старта", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "unknown", agentId: "service-1" },
      { ts: START + 3_000, kind: "tool", tool: "Bash", ok: false, command: "make check" },
      { ts: START + 4_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code", "review"]);
  });

  it("возвращает деталь с этапа станции, которая вернула работу", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 2_000, kind: "subagent_start", agent: "tester", agentId: "t1" },
      {
        ts: START + 3_000,
        kind: "subagent_stop",
        agent: "tester",
        agentId: "t1",
        verdict: "ДЕФЕКТ",
      },
      { ts: START + 4_000, kind: "subagent_start", agent: "coder", agentId: "c2" },
      { ts: START + 5_000, kind: "subagent_stop", agent: "coder", agentId: "c2" },
      { ts: START + 6_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      {
        ts: START + 7_000,
        kind: "subagent_stop",
        agent: "reviewer",
        agentId: "r1",
        verdict: "НА ДОРАБОТКУ",
      },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual([
      "code",
      "test",
      "fail:test",
      "code",
      "review",
      "fail:review",
    ]);
  });

  it.each([
    ["ПРИНЯТО", true],
    ["НА ДОРАБОТКУ", false],
  ])("пишет вердикт ревью «%s» как исход проверок с запуском: %s", (verdict, ok) => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
      { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1", verdict },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(checksOf(draft.events)).toEqual([{ ok: false }, { ok, run: "r1" }]);
  });

  it("считает «ГОТОВО» тестировщика пройденными проверками", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
      { ts: START + 1_000, kind: "subagent_start", agent: "tester", agentId: "t1" },
      {
        ts: START + 2_000,
        kind: "subagent_stop",
        agent: "tester",
        agentId: "t1",
        verdict: "ГОТОВО",
      },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect([stagesOf(draft.events), checksOf(draft.events).at(-1)]).toEqual([
      ["test", "fail:test", "test"],
      { ok: true, run: "t1" },
    ]);
  });

  it.each([
    ["coder", "ДЕФЕКТ"],
    ["coder", "НА ДОРАБОТКУ"],
    ["analyst", "ДЕФЕКТ"],
    ["tester", "НА ДОРАБОТКУ"],
    ["reviewer", "ДЕФЕКТ"],
    ["reviewer", "ГОТОВО"],
  ])("не считает вердиктом первую строку «%s»: «%s»", (agent, verdict) => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent, agentId: "a1" },
      { ts: START + 1_000, kind: "subagent_stop", agent, agentId: "a1", verdict },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect([
      stagesOf(draft.events).filter((stage) => stage.startsWith("fail:")),
      checksOf(draft.events),
    ]).toEqual([[], []]);
  });

  it("берёт вердикт станции из её отчёта по id агента", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
      { ts: START + 1_100, kind: "subagent_report", agentId: "r1", verdict: "НА ДОРАБОТКУ" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["review", "fail:review"]);
  });

  it("судит запуск станции один раз, даже если вердикт пришёл и с остановкой, и отчётом", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "tester", agentId: "t1" },
      {
        ts: START + 1_000,
        kind: "subagent_stop",
        agent: "tester",
        agentId: "t1",
        verdict: "ДЕФЕКТ",
      },
      { ts: START + 1_100, kind: "subagent_report", agentId: "t1", verdict: "ДЕФЕКТ" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["test", "fail:test"]);
  });

  it("не судит отчёт агента, запуск которого не попал в журнал", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 1_000, kind: "subagent_report", agentId: "r1", verdict: "НА ДОРАБОТКУ" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code"]);
  });

  it("судит заново повторный запуск того же агента", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 1_000, kind: "subagent_report", agentId: "r1", verdict: "НА ДОРАБОТКУ" },
      { ts: START + 2_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 3_000, kind: "subagent_report", agentId: "r1", verdict: "НА ДОРАБОТКУ" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["review", "fail:review", "review", "fail:review"]);
  });

  it.each(["constructor", "Готово"])(
    "не считает вердиктом строку «%s» и не меняет по ней итог сборки",
    (verdict) => {
      const raw: RawEvent[] = [
        { ts: START, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
        { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
        { ts: START + 2_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1", verdict },
      ];

      const draft = toDraft(raw, { sessionId: "s1" });

      expect([stagesOf(draft.events), checksOf(draft.events)]).toEqual([
        ["test", "fail:test", "review"],
        [{ ok: false }],
      ]);
    },
  );

  it("не считает вердиктом ответ сабагента без своего этапа", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 1_000, kind: "subagent_start", agent: "general-purpose", agentId: "g1" },
      {
        ts: START + 2_000,
        kind: "subagent_stop",
        agent: "general-purpose",
        agentId: "g1",
        verdict: "ДЕФЕКТ",
      },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code"]);
  });

  it("ведёт сборку как обычно по инструментам сабагента без своего этапа", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "general-purpose", agentId: "g1" },
      { ts: START + 1_000, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 2_000, kind: "subagent_stop", agent: "general-purpose", agentId: "g1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code"]);
  });

  it.each([
    "make check-web check-api",
    "pnpm lint",
    "pnpm -r run check",
    "pnpm --filter @cyberzavod/core check",
    "pnpm exec vitest run",
    "npx eslint .",
    "go test ./...",
    "golangci-lint run ./...",
    "node --test",
    "cd apps/api && go test ./...",
    "CI=1 pnpm test",
    "cd apps/api\ngo test ./...",
  ])("засчитывает упавший запуск «%s» как неудачу проверок", (command) => {
    const raw: RawEvent[] = [{ ts: START, kind: "tool", tool: "Bash", ok: false, command }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["test", "fail:test"]);
  });

  it.each([
    "cat eslint.config.js",
    "cat apps/web/vitest.config.ts",
    "grep -rn vitest packages",
    "pnpm add -D eslint-plugin-jsdoc",
    "ls node_modules/@vitest/eslint-plugin",
    "echo make check",
  ])("не считает «%s» проверками", (command) => {
    const raw: RawEvent[] = [{ ts: START, kind: "tool", tool: "Bash", ok: false, command }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual([]);
  });

  it("проходит проверки и выпуск успешной цепочкой в одной команде", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Bash", ok: true, command: "make check && git commit -m x" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["test", "ship"]);
  });

  it("относит упавшую цепочку проверок и коммита к неудаче проверок", () => {
    const raw: RawEvent[] = [
      {
        ts: START,
        kind: "tool",
        tool: "Bash",
        ok: false,
        command: "make check && git commit -m x",
      },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["test", "fail:test"]);
  });

  it("относит выход из режима планирования к этапу spec", () => {
    const raw: RawEvent[] = [{ ts: START, kind: "tool", tool: "ExitPlanMode", ok: true }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["spec"]);
  });

  it.each([
    ["Plan", "spec"],
    ["analyst", "spec"],
    ["coder", "code"],
    ["tester", "test"],
    ["reviewer", "review"],
  ])("относит работу агента %s к этапу %s", (agent, stage) => {
    const raw: RawEvent[] = [{ ts: START, kind: "subagent_start", agent, agentId: "a1" }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual([stage]);
  });

  it("отдаёт промпт модели, которая первой ответила после него", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "первый" },
      { ts: START + 10_000, kind: "prompt", text: "второй" },
      { ts: START + 20_000, kind: "prompt", text: "третий" },
    ];
    const replies = [
      { ts: START - 1_000, model: "claude-haiku-4-5" },
      { ts: START + 2_000, model: "claude-opus-5-5" },
      { ts: START + 12_000, model: "claude-sonnet-5-5" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", replies });

    expect(
      draft.events.flatMap((event) => (event.type === "draft_prompt" ? [event.model] : [])),
    ).toEqual(["claude-opus-5-5", "claude-sonnet-5-5", undefined]);
  });

  it("не пропускает служебные сообщения в промпты", () => {
    const raw: RawEvent[] = [
      {
        ts: START,
        kind: "prompt",
        text: "[Subagent hand-back] The text below is the final report…",
      },
      {
        ts: START + 1_000,
        kind: "prompt",
        text: "  <task-notification>готово</task-notification>",
      },
      { ts: START + 2_000, kind: "prompt", text: "Сделай проигрыватель" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(
      draft.events.flatMap((event) => (event.type === "draft_prompt" ? [event.said] : [])),
    ).toEqual(["Сделай проигрыватель"]);
  });
});

describe("isHumanPrompt", () => {
  it("отличает сообщение человека от служебного", () => {
    const texts = ["Сделай цех", "[SYSTEM NOTIFICATION - NOT USER INPUT]", "<system-reminder>…"];

    const results = texts.map(isHumanPrompt);

    expect(results).toEqual([true, false, false]);
  });
});

describe("sessionTranscriptPaths", () => {
  it("собирает транскрипты остановок сессии без повторов и без сабагентов", () => {
    const raw: RawEvent[] = [
      { ts: 1, kind: "subagent_stop", agent: "reviewer", transcriptPath: "/t/agent.jsonl" },
      { ts: 2, kind: "stop", transcriptPath: "/t/main.jsonl" },
      { ts: 3, kind: "stop", transcriptPath: "/t/main.jsonl" },
    ];

    const paths = sessionTranscriptPaths(raw);

    expect(paths).toEqual(["/t/main.jsonl"]);
  });
});

describe("runTranscriptPaths", () => {
  it("собирает транскрипты запусков по agentId, у повторной остановки — последний", () => {
    const raw: RawEvent[] = [
      { ts: 1, kind: "subagent_stop", agent: "coder", agentId: "c1", transcriptPath: "/t/old" },
      { ts: 2, kind: "subagent_stop", agent: "coder", agentId: "c1", transcriptPath: "/t/new" },
      { ts: 3, kind: "subagent_stop", agent: "tester", agentId: "t1" },
      { ts: 4, kind: "subagent_stop", agent: "tester", transcriptPath: "/t/no-id" },
      { ts: 5, kind: "stop", transcriptPath: "/t/main.jsonl" },
    ];

    const paths = runTranscriptPaths(raw);

    expect([...paths]).toEqual([["c1", "/t/new"]]);
  });
});

describe("sessionTranscriptPath", () => {
  it("берёт транскрипт остановки сессии, а не сабагента", () => {
    const raw: RawEvent[] = [
      { ts: 1, kind: "stop", transcriptPath: "/t/main.jsonl" },
      { ts: 2, kind: "subagent_stop", agent: "reviewer", transcriptPath: "/t/agent.jsonl" },
    ];

    const transcriptPath = sessionTranscriptPath(raw);

    expect(transcriptPath).toBe("/t/main.jsonl");
  });
});

function chatSession(): RawEvent[] {
  return [
    { ts: START, kind: "session_start" },
    { ts: START + 1_000, kind: "prompt", text: "Сделай задачу" },
    { ts: START + 2_000, kind: "subagent_start", agent: "analyst", agentId: "a1" },
    { ts: START + 9_000, kind: "subagent_stop", agent: "analyst", agentId: "a1" },
    { ts: START + 10_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
    { ts: START + 20_000, kind: "subagent_start", agent: "Explore", agentId: "e1" },
    { ts: START + 30_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
    { ts: START + 40_000, kind: "stop" },
  ];
}

function spawn(ts: number, agentType: string): AgentAssignment {
  return { ts: START + ts, text: `Задание ${agentType}`, via: "spawn", agentType };
}

function report(ts: number, agentId: string): AgentReport {
  return { ts: START + ts, agentId, text: `Отчёт ${agentId}` };
}

function answer(ts: number, text = "Итог"): TranscriptText {
  return { ts: START + ts, text };
}

function message(ts: number, agentId: string): AgentAssignment {
  return { ts: START + ts, text: `Сообщение ${agentId}`, via: "message", agentId };
}

// Реплики черновика: время, от кого, кому и откуда в сессии.
function routesOf(draft: { events: DraftEvent[] }) {
  return draft.events.flatMap((event) =>
    event.type === "draft_message" ? [[event.t, event.from, event.to, event.source]] : [],
  );
}

describe("toDraft: реплики", () => {
  it("даёт заданию этап агента, в том числе для Plan и сообщения работающему", () => {
    const assignments: AgentAssignment[] = [
      spawn(1_500, "analyst"),
      spawn(1_700, "Plan"),
      message(15_000, "c1"),
    ];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments });

    expect(routesOf(draft).map(([t, from]) => [t, from])).toEqual([
      [1_500, "spec"],
      [1_700, "spec"],
      [15_000, "code"],
    ]);
  });

  it("кладёт исходный текст задания в said, а строку и текст оставляет редактору", () => {
    const assignments = [spawn(1_500, "analyst")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments });

    expect(draft.events.find((event) => event.type === "draft_message")).toEqual({
      t: 1_500,
      type: "draft_message",
      from: "spec",
      to: "foreman",
      source: "assignment",
      said: "Задание analyst",
      line: "",
      text: "",
    });
  });

  it("не даёт реплик агентам не из станций", () => {
    const assignments = [spawn(1_500, "Explore"), spawn(1_600, "general-purpose")];
    const reports = [report(25_000, "e1"), report(26_000, "неизвестный")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments, reports });

    expect(routesOf(draft)).toEqual([]);
  });

  it("прижимает время реплики к границам сборки", () => {
    const assignments = [spawn(-10_000, "analyst")];
    const reports = [report(500_000, "a1")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments, reports });

    expect(routesOf(draft).map(([t]) => t)).toEqual([0, 40_000]);
  });

  it("ставит реплику после событий с тем же временем", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 5_000, kind: "stop" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", assignments: [spawn(0, "analyst")] });

    expect(draft.events.map((event) => event.type)).toEqual(["stage_enter", "draft_message"]);
  });

  it("не теряет порядок реплик одного момента: задание, отчёт, ответ", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "Сделай" },
      { ts: START + 1_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 5_000, kind: "stop" },
    ];

    const draft = toDraft(raw, {
      sessionId: "s1",
      answers: [answer(5_000)],
      reports: [report(5_000, "c1")],
      assignments: [spawn(5_000, "coder")],
    });

    expect(draft.events.slice(3).map((event) => event.type)).toEqual([
      "draft_message",
      "draft_message",
      "draft_message",
    ]);
    expect(routesOf(draft)).toEqual([
      [5_000, "code", "foreman", "assignment"],
      [5_000, "code", "foreman", "report"],
      [5_000, "code", "foreman", "answer"],
    ]);
  });
});

describe("toDraft: маршруты реплик по правилу ремарок", () => {
  it("отдаёт задание сразу после задачи мастера: говорит принимающий, слушает мастер", () => {
    const assignments = [spawn(1_500, "analyst")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments });

    expect(routesOf(draft)).toEqual([[1_500, "spec", "foreman", "assignment"]]);
  });

  it("отдаёт отчёт перед ответом человеку мастеру", () => {
    const reports = [report(9_000, "a1")];

    const draft = toDraft(chatSession(), { sessionId: "s1", reports, answers: [answer(35_000)] });

    expect(routesOf(draft)).toEqual([
      [9_000, "spec", "foreman", "report"],
      [35_000, "code", "foreman", "answer"],
    ]);
  });

  it("отдаёт отчёт мастеру, если после него нет ни задания, ни ответа", () => {
    const reports = [report(30_000, "c1")];

    const draft = toDraft(chatSession(), { sessionId: "s1", reports });

    expect(routesOf(draft)).toEqual([[30_000, "code", "foreman", "report"]]);
  });

  it("адресует отчёт следующему по заданию, а задание — тому, кто сдал работу", () => {
    const reports = [report(30_000, "c1")];
    const assignments = [spawn(1_500, "coder"), spawn(31_000, "tester")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments, reports });

    expect(routesOf(draft)).toEqual([
      [1_500, "code", "foreman", "assignment"],
      [30_000, "code", "test", "report"],
      [31_000, "test", "code", "assignment"],
    ]);
  });

  it("пропускает сообщение той же станции при поиске адресата отчёта", () => {
    const reports = [report(30_000, "c1")];
    const assignments = [message(30_500, "c1"), spawn(31_000, "tester")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments, reports });

    expect(routesOf(draft)).toEqual([
      [30_000, "code", "test", "report"],
      [30_500, "code", "foreman", "assignment"],
      [31_000, "test", "code", "assignment"],
    ]);
  });

  it("не берёт адресатом отчёта задание, стоящее после ответа человеку", () => {
    const reports = [report(30_000, "c1")];
    const assignments = [spawn(35_000, "tester")];

    const draft = toDraft(chatSession(), {
      sessionId: "s1",
      assignments,
      reports,
      answers: [answer(32_000)],
    });

    expect(routesOf(draft).slice(0, 2)).toEqual([
      [30_000, "code", "foreman", "report"],
      [32_000, "code", "foreman", "answer"],
    ]);
  });

  it("считает ходы отдельно: отчёт прошлого хода не адресат задания следующего", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 1_000, kind: "prompt", text: "Первое" },
      { ts: START + 2_000, kind: "subagent_start", agent: "analyst", agentId: "a1" },
      { ts: START + 20_000, kind: "prompt", text: "Второе" },
      { ts: START + 40_000, kind: "stop" },
    ];
    const reports = [report(9_000, "a1")];
    const assignments = [spawn(21_000, "coder")];

    const draft = toDraft(raw, { sessionId: "s1", assignments, reports });

    expect(routesOf(draft)).toEqual([
      [9_000, "spec", "foreman", "report"],
      [21_000, "code", "foreman", "assignment"],
    ]);
  });

  it("собирает в отдельный ход то, что прозвучало до первого промпта", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 100, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "prompt", text: "Первое" },
      { ts: START + 40_000, kind: "stop" },
    ];
    const reports = [report(800, "c1")];
    const assignments = [spawn(500, "coder"), spawn(2_000, "tester")];

    const draft = toDraft(raw, { sessionId: "s1", assignments, reports });

    expect(routesOf(draft)).toEqual([
      [500, "code", "foreman", "assignment"],
      [800, "code", "foreman", "report"],
      [2_000, "test", "foreman", "assignment"],
    ]);
  });

  it("не берёт ответ без промпта человека", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 1_000, kind: "prompt", text: "Вопрос" },
      { ts: START + 9_000, kind: "stop" },
    ];
    const answers = [answer(500, "До промпта"), answer(2_000, "Промежуточный"), answer(4_000)];

    const draft = toDraft(raw, { sessionId: "s1", answers });

    expect(
      draft.events.flatMap((event) => (event.type === "draft_message" ? [event.said] : [])),
    ).toEqual(["Итог"]);
  });

  it("отвечает от рабочего этапа в момент ответа, даже если в ходе работала станция", () => {
    const answers = [answer(35_000)];

    const draft = toDraft(chatSession(), { sessionId: "s1", answers });

    expect(routesOf(draft)).toEqual([[35_000, "code", "foreman", "answer"]]);
  });

  it("отвечает от рабочего этапа в момент ответа, если станций в ходе не было", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "Объясни" },
      { ts: START + 2_000, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 6_000, kind: "stop" },
    ];
    const answers = [answer(1_000, "Ответ до правок"), answer(5_000, "Ответ после правок")];

    const draft = toDraft(raw, { sessionId: "s1", answers });

    expect(routesOf(draft)).toEqual([[5_000, "code", "foreman", "answer"]]);
  });

  it("берёт этап постановки, пока деталь ещё не вышла со своего первого станка", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "Объясни" },
      { ts: START + 2_000, kind: "stop" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", answers: [answer(1_000)] });

    expect(routesOf(draft)).toEqual([[1_000, "spec", "foreman", "answer"]]);
  });

  it("не считает ходом служебное сообщение среды", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "Вопрос" },
      { ts: START + 2_000, kind: "prompt", text: "<task-notification>готово</task-notification>" },
      { ts: START + 9_000, kind: "stop" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", answers: [answer(1_000), answer(3_000)] });

    expect(routesOf(draft)).toEqual([[3_000, "spec", "foreman", "answer"]]);
  });

  // Прогон с возвратом на доработку: задача, постановка, код, проверки, ревью с возвратом,
  // правки, снова проверки и ревью, выпуск и ответ.
  it("сводит сквозной прогон с возвратом к маршрутам из таблицы", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 1_000, kind: "prompt", text: "/feature 7" },
      { ts: START + 2_000, kind: "subagent_start", agent: "analyst", agentId: "a1" },
      { ts: START + 9_500, kind: "subagent_stop", agent: "analyst", agentId: "a1" },
      { ts: START + 30_000, kind: "prompt", text: "Одобряю" },
      { ts: START + 31_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 40_500, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 41_000, kind: "subagent_start", agent: "tester", agentId: "t1" },
      { ts: START + 50_500, kind: "subagent_stop", agent: "tester", agentId: "t1" },
      { ts: START + 51_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 91_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
      { ts: START + 95_000, kind: "tool", tool: "Bash", ok: true, command: "git commit -m x" },
      { ts: START + 110_000, kind: "stop" },
    ];
    const assignments = [
      spawn(2_000, "analyst"),
      spawn(31_000, "coder"),
      spawn(41_000, "tester"),
      spawn(51_000, "reviewer"),
      message(61_000, "c1"),
      message(71_000, "t1"),
      message(81_000, "r1"),
    ];
    const reports = [
      report(9_000, "a1"),
      report(40_000, "c1"),
      report(50_000, "t1"),
      report(60_000, "r1"),
      report(70_000, "c1"),
      report(80_000, "t1"),
      report(90_000, "r1"),
    ];
    const answers = [answer(10_000), answer(100_000)];

    const draft = toDraft(raw, { sessionId: "s1", assignments, reports, answers });

    expect(routesOf(draft).map(([t, from, to]) => [t, from, to])).toEqual([
      [2_000, "spec", "foreman"],
      [9_000, "spec", "foreman"],
      [10_000, "spec", "foreman"],
      [31_000, "code", "foreman"],
      [40_000, "code", "test"],
      [41_000, "test", "code"],
      [50_000, "test", "review"],
      [51_000, "review", "test"],
      [60_000, "review", "code"],
      [61_000, "code", "review"],
      [70_000, "code", "test"],
      [71_000, "test", "code"],
      [80_000, "test", "review"],
      [81_000, "review", "test"],
      [90_000, "review", "foreman"],
      [100_000, "ship", "foreman"],
    ]);
  });
});

describe("stationTranscriptPaths", () => {
  it("берёт транскрипты остановленных станций без повторов", () => {
    const raw: RawEvent[] = [
      { ts: 1, kind: "subagent_stop", agent: "analyst", transcriptPath: "/t/a.jsonl" },
      { ts: 2, kind: "subagent_stop", agent: "analyst", transcriptPath: "/t/a.jsonl" },
      { ts: 3, kind: "subagent_stop", agent: "Plan", transcriptPath: "/t/p.jsonl" },
      { ts: 4, kind: "subagent_stop", agent: "Explore", transcriptPath: "/t/e.jsonl" },
      { ts: 5, kind: "subagent_stop", agent: "coder" },
      { ts: 6, kind: "stop", transcriptPath: "/t/session.jsonl" },
    ];

    const paths = stationTranscriptPaths(raw);

    expect(paths).toEqual(["/t/a.jsonl", "/t/p.jsonl"]);
  });
});

function runsOf(draft: Draft) {
  return draft.events.flatMap((event) =>
    event.type === "draft_run" ? [[event.run, event.agent, event.t, event.until]] : [],
  );
}

describe("toDraft: запуски станций", () => {
  it("пишет окно запуска от старта до остановки станции", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "analyst", agentId: "a1" },
      { ts: START + 4_000, kind: "subagent_stop", agent: "analyst", agentId: "a1" },
      { ts: START + 9_000, kind: "stop" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(runsOf(draft)).toEqual([["a1", "analyst", 0, 4_000]]);
  });

  it("тянет окно запуска без остановки до конца журнала", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 9_000, kind: "stop" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(runsOf(draft)).toEqual([["c1", "coder", 0, 9_000]]);
  });

  it("пишет отдельное окно на каждый старт одного и того же запуска", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 5_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 6_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(runsOf(draft)).toEqual([
      ["c1", "coder", 0, 1_000],
      ["c1", "coder", 5_000, 6_000],
    ]);
  });

  it("не пишет окна служебным сабагентам без своего этапа", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "Explore", agentId: "e1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "Explore", agentId: "e1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(runsOf(draft)).toEqual([]);
  });

  it("входит на этап при каждом старте станции, даже если этап тот же", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 2_000, kind: "subagent_start", agent: "coder", agentId: "c2" },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(
      draft.events.flatMap((event) => (event.type === "stage_enter" ? [event.run] : [])),
    ).toEqual(["c1", "c2"]);
  });

  it("не повторяет этап правками, пока сборка стоит на нём", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 1_000, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 2_000, kind: "tool", tool: "Write", ok: true },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["code"]);
  });

  it("ставит запуск на возврат по вердикту и на исход проверок", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "tester", agentId: "t1" },
      {
        ts: START + 1_000,
        kind: "subagent_stop",
        agent: "tester",
        agentId: "t1",
        verdict: "ДЕФЕКТ",
      },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events.filter((event) => event.type === "stage_fail")).toEqual([
      { t: 1_000, type: "stage_fail", stage: "test", reason: expect.any(String), run: "t1" },
    ]);
    expect(checksOf(draft.events)).toEqual([{ ok: false, run: "t1" }]);
  });

  it("ставит запуск станции на реплики: у задания новому запуску и у отчёта — его id", () => {
    const assignments: AgentAssignment[] = [
      { ts: START + 1_500, text: "Задание", via: "spawn", agentType: "analyst", agentId: "a1" },
    ];
    const reports = [report(9_000, "a1")];

    const draft = toDraft(chatSession(), { sessionId: "s1", assignments, reports });

    expect(
      draft.events.flatMap((event) =>
        event.type === "draft_message" ? [[event.source, event.run]] : [],
      ),
    ).toEqual([
      ["assignment", "a1"],
      ["report", "a1"],
    ]);
  });

  it("ставит на сообщение работающему его id, а у задания без agentId и ответа запуска нет", () => {
    const assignments = [message(15_000, "c1"), spawn(1_500, "analyst")];

    const draft = toDraft(chatSession(), {
      sessionId: "s1",
      assignments,
      answers: [answer(35_000)],
    });

    expect(
      draft.events.flatMap((event) =>
        event.type === "draft_message" ? [[event.source, event.run]] : [],
      ),
    ).toEqual([
      ["assignment", undefined],
      ["assignment", "c1"],
      ["answer", undefined],
    ]);
  });
});

function usagesOf(draft: Draft) {
  return draft.events.flatMap((event) =>
    event.type === "usage" ? [{ t: event.t, tokens: event.tokens, run: event.run }] : [],
  );
}

describe("toDraft: токены", () => {
  it("ставит токены станции на её последнюю остановку с запуском", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 5_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 6_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", runTokens: new Map([["c1", 500]]) });

    expect(usagesOf(draft)).toEqual([{ t: 6_000, tokens: 500, run: "c1" }]);
  });

  it("ставит токены служебного сабагента на его остановку без запуска", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "Explore", agentId: "e1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "Explore", agentId: "e1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", runTokens: new Map([["e1", 40]]) });

    expect(usagesOf(draft)).toEqual([{ t: 2_000, tokens: 40, run: undefined }]);
  });

  it("не пишет токенов запуску, чьи токены неизвестны", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 1_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
    ];

    const draft = toDraft(raw, { sessionId: "s1", runTokens: new Map() });

    expect(usagesOf(draft)).toEqual([]);
  });

  describe("участки основной сессии", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start" },
      { ts: START + 1_000, kind: "prompt", text: "Сделай" },
      { ts: START + 2_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 6_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      { ts: START + 20_000, kind: "stop" },
    ];

    it("суммирует сообщения между соседними привязками в одно usage на время первой", () => {
      const sessionUsages = [
        { ts: START + 1_500, tokens: 1 },
        { ts: START + 1_900, tokens: 2 },
        { ts: START + 3_000, tokens: 10 },
        { ts: START + 7_000, tokens: 100 },
        { ts: START + 8_000, tokens: 200 },
      ];

      const draft = toDraft(raw, {
        sessionId: "s1",
        sessionUsages,
        runTokens: new Map([["c1", 50]]),
      });

      expect(usagesOf(draft)).toEqual([
        { t: 1_000, tokens: 3, run: undefined },
        { t: 2_000, tokens: 10, run: undefined },
        { t: 6_000, tokens: 50, run: "c1" },
        { t: 6_000, tokens: 300, run: undefined },
      ]);
    });

    it("ставит сообщения до первой привязки в начало черновика", () => {
      const sessionUsages = [{ ts: START + 200, tokens: 4 }];

      const draft = toDraft(raw, { sessionId: "s1", sessionUsages });

      expect(draft.events[0]).toEqual({ t: 0, type: "usage", tokens: 4 });
    });

    it("не считает сообщения вне времени журнала", () => {
      const sessionUsages = [
        { ts: START - 1, tokens: 7 },
        { ts: START + 20_001, tokens: 9 },
      ];

      const draft = toDraft(raw, { sessionId: "s1", sessionUsages });

      expect(usagesOf(draft)).toEqual([]);
    });

    it("отдаёт участок последней из привязок с одним временем", () => {
      const raw: RawEvent[] = [
        { ts: START + 1_000, kind: "prompt", text: "Сделай" },
        { ts: START + 1_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
        { ts: START + 9_000, kind: "stop" },
      ];
      const sessionUsages = [{ ts: START + 2_000, tokens: 5 }];

      const draft = toDraft(raw, { sessionId: "s1", sessionUsages });

      expect(draft.events.map((event) => event.type)).toEqual([
        "draft_prompt",
        "stage_enter",
        "draft_run",
        "usage",
      ]);
    });

    it("считает в сумме токены станций и сообщений журнала без потерь", () => {
      const sessionUsages = [
        { ts: START + 100, tokens: 1 },
        { ts: START + 3_000, tokens: 20 },
        { ts: START + 10_000, tokens: 300 },
      ];

      const draft = toDraft(raw, {
        sessionId: "s1",
        sessionUsages,
        runTokens: new Map([["c1", 4_000]]),
      });

      expect(usagesOf(draft).reduce((sum, { tokens }) => sum + tokens, 0)).toBe(4_321);
    });
  });
});

const PROJECT_A = "/work/a";
const PROJECT_B = "/work/b";
const PROJECTS_BY_DIRECTORY = new Map([
  [PROJECT_A, "a"],
  [PROJECT_B, "b"],
  [`${PROJECT_B}/src`, "b"],
  [`${PROJECT_B}/src/state`, "b"],
]);

type ToolEvent = Extract<RawEvent, { kind: "tool" }>;

function bash(ts: number, command: string, cwd?: string, agentId?: string): ToolEvent {
  return {
    ts,
    kind: "tool",
    tool: "Bash",
    ok: true,
    command,
    ...(cwd === undefined ? {} : { cwd }),
    ...(agentId === undefined ? {} : { agentId }),
  };
}

function edit(ts: number, file: string, cwd?: string): RawEvent {
  return { ts, kind: "tool", tool: "Edit", ok: true, file, ...(cwd === undefined ? {} : { cwd }) };
}

// Этап или проверка и проект события по порядку: так видно, куда команда отнесена.
function projectMarksOf(draft: Draft): string[] {
  return draft.events.flatMap((event) => {
    const project = "project" in event && event.project !== undefined ? event.project : "—";
    if (event.type === "stage_enter") return [`${event.stage} ${project}`];
    if (event.type === "stage_fail") return [`fail:${event.stage} ${project}`];
    if (event.type === "draft_check") return [`check ${project}`];
    return [];
  });
}

describe("toDraft: проект команды", () => {
  const meta = { sessionId: "s1", projectsByDirectory: PROJECTS_BY_DIRECTORY };

  it("берёт проект из абсолютного cd", () => {
    const raw = [bash(START, `cd ${PROJECT_B} && pnpm check`, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test b", "check b"]);
  });

  it("берёт проект подкаталога, в который перешёл cd", () => {
    const raw = [bash(START, `cd ${PROJECT_B}/src/state && pnpm test`, PROJECT_A)];

    const draft = toDraft(raw, {
      sessionId: "s1",
      projectsByDirectory: new Map([[`${PROJECT_B}/src/state`, "b-state"]]),
    });

    expect(projectMarksOf(draft)).toEqual(["test b-state", "check b-state"]);
  });

  it("разрешает относительный cd от каталога вызова", () => {
    const raw = [bash(START, "cd src && pnpm test", PROJECT_B)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test b", "check b"]);
  });

  it("разрешает cd с двумя точками от каталога вызова", () => {
    const raw = [bash(START, "cd ../a && pnpm test", PROJECT_B)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test a", "check a"]);
  });

  it("снимает простые кавычки вокруг каталога", () => {
    const raw = [bash(START, `cd '${PROJECT_B}' && pnpm test`, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test b", "check b"]);
  });

  it("даёт сегментам цепочки с двумя cd разные проекты", () => {
    const raw = [
      bash(START, `cd ${PROJECT_A} && make check && cd ${PROJECT_B} && git commit -m x`),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test a", "check a", "ship b"]);
  });

  it("распознаёт git -C как выпуск проекта каталога", () => {
    const raw = [bash(START, `git -C ${PROJECT_B} commit -m x`, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["ship b"]);
  });

  it("не распространяет git -C на следующие команды цепочки", () => {
    const raw = [bash(START, `git -C ${PROJECT_B} commit -m x && git push`, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["ship b", "ship a"]);
  });

  it("берёт проект каталога правимого файла", () => {
    const raw = [edit(START, `${PROJECT_B}/src/lib.ts`, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["code b"]);
  });

  it("берёт проект каталога вызова, если cd в команде нет", () => {
    const raw = [bash(START, "make check-web", PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test a", "check a"]);
  });

  it("берёт проект из начала сессии для старого журнала без cwd", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start", project: "old", factory: "0.1.0" },
      bash(START + 1_000, "make check-web"),
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(projectMarksOf(draft)).toEqual(["test old", "check old"]);
  });

  it("не берёт проект сессии, когда относительный cd выходит из её каталога", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "session_start", project: "old", factory: "0.1.0" },
      bash(START + 1_000, "cd ../other && make check-web"),
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(projectMarksOf(draft)).toEqual(["test —", "check —"]);
  });

  it.each([
    "cd ~/x && make check",
    "cd $WORK && make check",
    "cd `pwd` && make check",
    "cd - && make check",
    "cd && make check",
  ])("оставляет без проекта команду «%s»", (command) => {
    const raw = [bash(START, command, PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test —", "check —"]);
  });

  it("оставляет без проекта каталог, которого нет в карте", () => {
    const raw = [bash(START, "cd /tmp && make check", PROJECT_A)];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test —", "check —"]);
  });

  it("ставит проект и на провал проверок", () => {
    const raw: RawEvent[] = [{ ...bash(START, "make check", PROJECT_B), ok: false }];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["test b", "check b", "fail:test b"]);
  });

  it("записывает команду основной сессии, пока работает станция", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      bash(START + 1_000, "make check", PROJECT_A),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["review —", "test a", "check a"]);
  });

  it("пропускает команду сабагента, чья станция работает", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      bash(START + 1_000, "make check", PROJECT_A, "r1"),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["review —"]);
  });

  it("записывает команду сабагента без станции", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      bash(START + 1_000, "make check", PROJECT_A, "e1"),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["review —", "test a", "check a"]);
  });

  it("входит на этап проекта b после станции code проекта a", () => {
    const raw: RawEvent[] = [
      edit(START, `${PROJECT_A}/x.ts`, PROJECT_A),
      { ts: START + 1_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      edit(START + 3_000, `${PROJECT_B}/x.ts`, PROJECT_B),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["code a", "code —", "code b"]);
  });

  it("входит на этап снова после работы станции того же проекта", () => {
    const raw: RawEvent[] = [
      edit(START, `${PROJECT_A}/x.ts`, PROJECT_A),
      { ts: START + 1_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "coder", agentId: "c1" },
      edit(START + 3_000, `${PROJECT_A}/x.ts`, PROJECT_A),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["code a", "code —", "code a"]);
  });

  it("не повторяет этап при повторных правках одного проекта", () => {
    const raw = [
      edit(START, `${PROJECT_B}/x.ts`, PROJECT_B),
      edit(START + 1_000, `${PROJECT_B}/y.ts`, PROJECT_B),
      edit(START + 2_000, `${PROJECT_B}/src/z.ts`, PROJECT_B),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["code b"]);
  });

  it("ведёт этап каждого проекта отдельно", () => {
    const raw = [
      edit(START, `${PROJECT_A}/x.ts`, PROJECT_A),
      edit(START + 1_000, `${PROJECT_B}/x.ts`, PROJECT_A),
      edit(START + 2_000, `${PROJECT_A}/y.ts`, PROJECT_A),
    ];

    const draft = toDraft(raw, meta);

    expect(projectMarksOf(draft)).toEqual(["code a", "code b"]);
  });
});

describe("toolDirectories", () => {
  it("собирает каталоги из cwd, cd, git -C и файлов без повторов", () => {
    const raw = [
      bash(START, "make check", PROJECT_A),
      bash(START + 1_000, `cd ${PROJECT_B}/src && pnpm test`, PROJECT_A),
      bash(START + 2_000, `git -C ${PROJECT_B} commit -m x`, PROJECT_A),
      edit(START + 3_000, `${PROJECT_B}/src/lib.ts`, PROJECT_A),
      bash(START + 4_000, "make check", PROJECT_A),
    ];

    const directories = toolDirectories(raw);

    expect(directories).toEqual([PROJECT_A, `${PROJECT_B}/src`, PROJECT_B]);
  });

  it("не называет каталоги нераспознанных мест и вызовов без этапа", () => {
    const raw: RawEvent[] = [
      bash(START, "cd ~/x && make check", PROJECT_A),
      bash(START + 1_000, "ls", PROJECT_B),
      {
        ts: START + 2_000,
        kind: "tool",
        tool: "Read",
        ok: true,
        file: `${PROJECT_B}/a.ts`,
        cwd: PROJECT_B,
      },
      bash(START + 3_000, "make check"),
    ];

    const directories = toolDirectories(raw);

    expect(directories).toEqual([]);
  });
});

function routedDraft(events: DraftEvent[], secondRuns: string[]): Draft {
  return {
    id: "first",
    startedAt: "2026-10-04T09:52:13.000Z",
    builds: [
      { id: "first", project: "p", factory: "0.1.0", title: "", runs: ["a1", "a2"] },
      { id: "second", project: "p", factory: "0.1.0", title: "", runs: secondRuns },
    ],
    events,
  };
}

function say(
  t: number,
  from: "spec" | "code" | "test" | "review",
  source: "assignment" | "report" | "answer",
  run?: string,
): DraftMessage {
  return {
    t,
    type: "draft_message",
    from,
    to: "foreman",
    source,
    said: `${source} ${t}`,
    line: "",
    text: "",
    ...(run === undefined ? {} : { run }),
  };
}

function routes(draft: Draft) {
  return draft.events.flatMap((event) =>
    event.type === "draft_message" ? [[event.t, event.from, event.to]] : [],
  );
}

describe("routeMessages", () => {
  it("не адресует отчёт станции одной задачи станции другой", () => {
    const draft = routedDraft(
      [
        { t: 0, type: "stage_enter", stage: "spec", run: "a1" },
        say(1_000, "spec", "report", "a1"),
        { t: 2_000, type: "stage_enter", stage: "code", run: "b1" },
        say(3_000, "code", "assignment", "b1"),
      ],
      ["b1"],
    );

    const routed = routeMessages(draft);

    expect(routes(routed)).toEqual([
      [1_000, "spec", "foreman"],
      [3_000, "code", "foreman"],
    ]);
  });

  it("не берёт отчёт другой задачи в отправители задания", () => {
    const draft = routedDraft(
      [
        say(1_000, "spec", "report", "a1"),
        say(2_000, "code", "assignment", "b1"),
        say(3_000, "test", "assignment", "a2"),
      ],
      ["b1"],
    );

    const routed = routeMessages(draft);

    expect(routes(routed)).toEqual([
      [1_000, "spec", "test"],
      [2_000, "code", "foreman"],
      [3_000, "test", "spec"],
    ]);
  });

  it("считает ходы по промптам сборки: промпт другой задачи ход не обрывает", () => {
    const prompt: DraftEvent = {
      t: 1_500,
      type: "draft_prompt",
      said: "вторая задача",
      goal: "",
      requirements: [],
      build: "second",
    };
    const draft = routedDraft(
      [
        say(1_000, "spec", "report", "a1"),
        prompt,
        say(2_000, "code", "assignment", "b1"),
        say(3_000, "test", "assignment", "a2"),
      ],
      ["b1"],
    );

    const routed = routeMessages(draft);

    expect(routes(routed)).toEqual([
      [1_000, "spec", "test"],
      [2_000, "code", "foreman"],
      [3_000, "test", "spec"],
    ]);
  });

  it("берёт этап ответа из событий его сборки", () => {
    const draft = routedDraft(
      [
        { t: 0, type: "stage_enter", stage: "review", run: "a1" },
        { t: 1_000, type: "stage_enter", stage: "code", run: "b1" },
        say(2_000, "spec", "answer"),
      ],
      ["b1"],
    );

    const routed = routeMessages(draft);

    expect(routes(routed)).toEqual([[2_000, "code", "foreman"]]);
  });

  it("сохраняет строку, текст, запуск и сборку реплики", () => {
    const draft = routedDraft([], ["b1"]);
    draft.events.push({
      ...say(1_000, "spec", "report", "a1"),
      line: "Держи",
      text: "Текст",
      build: "second",
    });

    const routed = routeMessages(draft);

    expect(routed.events).toEqual(draft.events.map((event) => ({ ...event, to: "foreman" })));
  });
});
