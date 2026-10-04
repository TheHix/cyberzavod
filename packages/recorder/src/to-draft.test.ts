import { describe, expect, it } from "vitest";
import type { DraftEvent } from "./draft.ts";
import type { RawEvent } from "./raw-event.ts";
import {
  isHumanPrompt,
  sessionTranscriptPath,
  stationTranscriptPaths,
  toDraft,
  transcriptPaths,
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

    expect([draft.events[0]?.t, draft.events.at(-1)?.t]).toEqual([0, 45_000]);
  });

  it("кладёт промпт как есть, а заголовок и чистовую версию оставляет редактору", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect({ title: draft.title, prompt: draft.events[1] }).toEqual({
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

  it("считает сборку неуспешной, если последний запуск проверок упал", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "почини" },
      { ts: START + 1_000, kind: "tool", tool: "Bash", ok: false, command: "go test ./..." },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events.at(-1)).toEqual({ t: 1_000, type: "build_end", ok: false });
  });

  it("добавляет токены перед концом сборки", () => {
    const raw = typicalSession();

    const draft = toDraft(raw, { sessionId: "s1", tokens: 12_345 });

    expect(draft.events.at(-2)).toEqual({ t: 45_000, type: "usage", tokens: 12_345 });
  });

  it("сортирует события не по порядку", () => {
    const raw = typicalSession().reverse();

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events[1]?.type).toBe("draft_prompt");
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
  ])("по последнему вердикту ревью «%s» считает сборку успешной: %s", (verdict, ok) => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
      { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
      { ts: START + 2_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1", verdict },
    ];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(draft.events.at(-1)).toEqual({ t: 2_000, type: "build_end", ok });
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

    expect([stagesOf(draft.events), draft.events.at(-1)]).toEqual([
      ["test", "fail:test"],
      { t: 2_000, type: "build_end", ok: true },
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
      draft.events.at(-1),
    ]).toEqual([[], { t: 1_000, type: "build_end", ok: true }]);
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

    expect(stagesOf(draft.events)).toEqual(["review", "fail:review", "fail:review"]);
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

      expect([stagesOf(draft.events), draft.events.at(-1)]).toEqual([
        ["test", "fail:test", "review"],
        { t: 2_000, type: "build_end", ok: false },
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

describe("transcriptPaths", () => {
  it("собирает транскрипты остановок сессии и сабагентов без повторов", () => {
    const raw: RawEvent[] = [
      { ts: 1, kind: "subagent_stop", agent: "reviewer", transcriptPath: "/t/agent.jsonl" },
      { ts: 2, kind: "stop", transcriptPath: "/t/main.jsonl" },
      { ts: 3, kind: "stop", transcriptPath: "/t/main.jsonl" },
    ];

    const paths = transcriptPaths(raw);

    expect(paths).toEqual(["/t/agent.jsonl", "/t/main.jsonl"]);
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

  it("ставит реплику после событий с тем же временем и до токенов и конца сборки", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "tool", tool: "Edit", ok: true },
      { ts: START + 5_000, kind: "stop" },
    ];

    const draft = toDraft(raw, {
      sessionId: "s1",
      tokens: 100,
      assignments: [spawn(0, "analyst")],
    });

    expect(draft.events.map((event) => event.type)).toEqual([
      "build_start",
      "stage_enter",
      "draft_message",
      "usage",
      "build_end",
    ]);
  });

  it("не теряет порядок реплик одного момента: задание, отчёт, ответ", () => {
    const raw: RawEvent[] = [
      { ts: START, kind: "prompt", text: "Сделай" },
      { ts: START + 1_000, kind: "subagent_start", agent: "coder", agentId: "c1" },
      { ts: START + 5_000, kind: "stop" },
    ];

    const draft = toDraft(raw, {
      sessionId: "s1",
      tokens: 100,
      answers: [answer(5_000)],
      reports: [report(5_000, "c1")],
      assignments: [spawn(5_000, "coder")],
    });

    expect(draft.events.slice(3).map((event) => event.type)).toEqual([
      "draft_message",
      "draft_message",
      "draft_message",
      "usage",
      "build_end",
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
