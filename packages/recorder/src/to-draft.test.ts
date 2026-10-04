import { describe, expect, it } from "vitest";
import type { DraftEvent } from "./draft.ts";
import type { RawEvent } from "./raw-event.ts";
import { isHumanPrompt, sessionTranscriptPath, toDraft, transcriptPaths } from "./to-draft.ts";

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

  it("относит работу агента Plan к этапу spec", () => {
    const raw: RawEvent[] = [{ ts: START, kind: "subagent_start", agent: "Plan", agentId: "p1" }];

    const draft = toDraft(raw, { sessionId: "s1" });

    expect(stagesOf(draft.events)).toEqual(["spec"]);
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
