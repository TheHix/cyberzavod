import { test } from "node:test";
import assert from "node:assert/strict";
import type { FactoryEvent } from "@cyberzavod/core";
import type { RawEvent } from "./raw-event.ts";
import { recordingId, toRecording, transcriptPaths } from "./to-recording.ts";

const START = 1_000_000;

function typicalSession(): RawEvent[] {
  return [
    { ts: START, kind: "session_start" },
    { ts: START + 1_000, kind: "prompt", text: "Добавь счётчик токенов" },
    { ts: START + 5_000, kind: "tool", tool: "Read", ok: true, file: "/a.ts" },
    { ts: START + 9_000, kind: "tool", tool: "Edit", ok: true, file: "/a.ts" },
    { ts: START + 12_000, kind: "tool", tool: "Bash", ok: false, command: "make check-web" },
    { ts: START + 15_000, kind: "tool", tool: "Edit", ok: true, file: "/a.ts" },
    { ts: START + 18_000, kind: "tool", tool: "Bash", ok: true, command: "make check-web check-api" },
    { ts: START + 20_000, kind: "subagent_start", agent: "reviewer" },
    { ts: START + 40_000, kind: "subagent_stop", agent: "reviewer" },
    { ts: START + 42_000, kind: "tool", tool: "Bash", ok: true, command: "git commit -m 'feat: …'" },
    { ts: START + 45_000, kind: "stop" },
  ];
}

function stagesOf(events: FactoryEvent[]): string[] {
  return events.flatMap((event) => {
    if (event.type === "stage_enter") return [event.stage];
    if (event.type === "stage_fail") return [`fail:${event.stage}`];
    return [];
  });
}

test("типичная сессия проходит этапы код → проверки → код → проверки → ревью → выпуск", () => {
  // Arrange
  const raw = typicalSession();

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["code", "test", "fail:test", "code", "test", "review", "ship"]);
});

test("время событий отсчитывается от начала сессии", () => {
  // Arrange
  const raw = typicalSession();

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.events[0]?.t, 0);
  assert.equal(recording.events.at(-1)?.t, 45_000);
});

test("заголовок — первый промпт", () => {
  // Arrange
  const raw = typicalSession();

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.title, "Добавь счётчик токенов");
});

test("длинный промпт в заголовке обрезается многоточием", () => {
  // Arrange
  const raw: RawEvent[] = [{ ts: START, kind: "prompt", text: "а".repeat(200) }];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.title.length, 80);
  assert.ok(recording.title.endsWith("…"));
});

test("сборка неуспешна, если последний запуск проверок упал", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: START, kind: "prompt", text: "почини" },
    { ts: START + 1_000, kind: "tool", tool: "Bash", ok: false, command: "go test ./..." },
  ];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(recording.events.at(-1), { t: 1_000, type: "build_end", ok: false });
});

test("токены из транскрипта попадают в запись перед концом сборки", () => {
  // Arrange
  const raw = typicalSession();

  // Act
  const recording = toRecording(raw, { id: "s1", tokens: 12_345 });

  // Assert
  assert.deepEqual(recording.events.at(-2), { t: 45_000, type: "usage", tokens: 12_345 });
});

test("события не по порядку сортируются по времени", () => {
  // Arrange
  const raw = typicalSession().reverse();

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.events[1]?.type, "prompt");
});

test("проверки внутри работы ревьюера не возвращают сборку на этап тестов", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: START, kind: "tool", tool: "Edit", ok: true },
    { ts: START + 1_000, kind: "subagent_start", agent: "reviewer" },
    { ts: START + 2_000, kind: "tool", tool: "Bash", ok: false, command: "make check" },
    { ts: START + 3_000, kind: "subagent_stop", agent: "reviewer" },
    { ts: START + 4_000, kind: "tool", tool: "Bash", ok: true, command: "git commit -m x" },
  ];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["code", "review", "ship"]);
  assert.deepEqual(recording.events.at(-1), { t: 4_000, type: "build_end", ok: true });
});

test("выход из режима планирования — этап spec", () => {
  // Arrange
  const raw: RawEvent[] = [{ ts: START, kind: "tool", tool: "ExitPlanMode", ok: true }];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["spec"]);
});

test("работа агента Plan — этап spec", () => {
  // Arrange
  const raw: RawEvent[] = [{ ts: START, kind: "subagent_start", agent: "Plan", agentId: "p1" }];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["spec"]);
});

test("остановка служебного сабагента без старта не закрывает окно ревьюера", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: START, kind: "tool", tool: "Edit", ok: true },
    { ts: START + 1_000, kind: "subagent_start", agent: "reviewer", agentId: "r1" },
    { ts: START + 2_000, kind: "subagent_stop", agent: "unknown", agentId: "service-1" },
    { ts: START + 3_000, kind: "tool", tool: "Bash", ok: false, command: "make check" },
    { ts: START + 4_000, kind: "subagent_stop", agent: "reviewer", agentId: "r1" },
  ];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["code", "review"]);
});

test("инструменты сабагента без своего этапа ведут сборку как обычно", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: START, kind: "subagent_start", agent: "general-purpose", agentId: "g1" },
    { ts: START + 1_000, kind: "tool", tool: "Edit", ok: true },
    { ts: START + 2_000, kind: "subagent_stop", agent: "general-purpose", agentId: "g1" },
  ];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.deepEqual(stagesOf(recording.events), ["code"]);
});

test("эмодзи в обрезанном заголовке не разрезается", () => {
  // Arrange
  const raw: RawEvent[] = [{ ts: START, kind: "prompt", text: `${"а".repeat(78)}🚀🚀🚀` }];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.title, `${"а".repeat(78)}🚀…`);
});

test("id записи — дата начала сессии и начало её id", () => {
  // Act
  const id = recordingId("744e7547-d312-42c4", Date.UTC(2026, 9, 4, 12));

  // Assert
  assert.equal(id, "2026-10-04-744e7547");
});

test("транскрипты собираются из остановок сессии и сабагентов без повторов", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: 1, kind: "subagent_stop", agent: "reviewer", transcriptPath: "/t/agent.jsonl" },
    { ts: 2, kind: "stop", transcriptPath: "/t/main.jsonl" },
    { ts: 3, kind: "stop", transcriptPath: "/t/main.jsonl" },
  ];

  // Act
  const paths = transcriptPaths(raw);

  // Assert
  assert.deepEqual(paths, ["/t/agent.jsonl", "/t/main.jsonl"]);
});

test("отчёт сабагента и уведомления не считаются промптами и не идут в заголовок", () => {
  // Arrange
  const raw: RawEvent[] = [
    { ts: START, kind: "prompt", text: "[Subagent hand-back] The text below is the final report…" },
    { ts: START + 1_000, kind: "prompt", text: "  <task-notification>готово</task-notification>" },
    { ts: START + 2_000, kind: "prompt", text: "Сделай проигрыватель" },
  ];

  // Act
  const recording = toRecording(raw, { id: "s1" });

  // Assert
  assert.equal(recording.title, "Сделай проигрыватель");
  assert.deepEqual(
    recording.events.filter((event) => event.type === "prompt").map((event) => event.t),
    [2_000],
  );
});
