import { test } from "node:test";
import assert from "node:assert/strict";
import { fromHookPayload, isSafeSessionId, parseRawLog, RawLogError } from "./raw-event.ts";

const TS = 1_000;

test("промпт пользователя становится событием prompt", () => {
  // Arrange
  const payload = { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "Сделай цех" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "prompt", text: "Сделай цех" });
});

test("успешный вызов инструмента сохраняет команду и файл, но не ответ", () => {
  // Arrange
  const payload = {
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "make check-web" },
    tool_response: { stdout: "очень длинный вывод" },
  };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "tool", tool: "Bash", ok: true, command: "make check-web" });
});

test("упавший инструмент помечается ok: false", () => {
  // Arrange
  const payload = { hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: { file_path: "/a.ts" } };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "tool", tool: "Edit", ok: false, file: "/a.ts" });
});

test("длинная команда обрезается", () => {
  // Arrange
  const payload = { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "x".repeat(500) } };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.equal(event?.kind === "tool" ? event.command?.length : undefined, 200);
});

test("сабагент без типа записывается как unknown", () => {
  // Arrange
  const payload = { hook_event_name: "SubagentStart" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "subagent_start", agent: "unknown" });
});

test("ненужное для записи событие пропускается", () => {
  // Arrange
  const payload = { hook_event_name: "Notification", message: "жду ввода" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.equal(event, null);
});

test("оборванная строка журнала пропускается, остальные читаются", () => {
  // Arrange
  const log = '{"ts":1,"kind":"session_start"}\n{"ts":2,"kind":"pro\n{"ts":3,"kind":"stop"}\n';

  // Act
  const events = parseRawLog(log);

  // Assert
  assert.deepEqual(events, [
    { ts: 1, kind: "session_start" },
    { ts: 3, kind: "stop" },
  ]);
});

test("начало сессии становится событием session_start", () => {
  // Arrange
  const payload = { hook_event_name: "SessionStart", session_id: "s1", source: "startup" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "session_start" });
});

test("остановка сохраняет путь к транскрипту", () => {
  // Arrange
  const payload = { hook_event_name: "Stop", transcript_path: "/t/main.jsonl", stop_hook_active: false };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "stop", transcriptPath: "/t/main.jsonl" });
});

test("остановка сабагента сохраняет его транскрипт", () => {
  // Arrange
  const payload = { hook_event_name: "SubagentStop", agent_type: "reviewer", agent_transcript_path: "/t/agent.jsonl" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "subagent_stop", agent: "reviewer", transcriptPath: "/t/agent.jsonl" });
});

test("путь блокнота берётся из notebook_path", () => {
  // Arrange
  const payload = { hook_event_name: "PostToolUse", tool_name: "NotebookEdit", tool_input: { notebook_path: "/n.ipynb" } };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "tool", tool: "NotebookEdit", ok: true, file: "/n.ipynb" });
});

test("безопасный session_id принимается, путь с переходами — нет", () => {
  // Act
  const results = ["744e7547-d312-42c4-88a0-fd9089104079", "../../evil", "a/b", "", 42].map(isSafeSessionId);

  // Assert
  assert.deepEqual(results, [true, false, false, false, false]);
});

test("строка журнала не той формы — ошибка с номером строки", () => {
  // Arrange
  const log = '{"ts":1,"kind":"session_start"}\n{"foo":"bar"}\n';

  // Act
  const act = () => parseRawLog(log);

  // Assert
  assert.throws(act, (err: unknown) => err instanceof RawLogError && /строка 2/.test(err.message));
});

test("служебный сабагент с пустым типом записывается как unknown, его id сохраняется", () => {
  // Arrange
  const payload = { hook_event_name: "SubagentStop", agent_type: "", agent_id: "a52e" };

  // Act
  const event = fromHookPayload(payload, TS);

  // Assert
  assert.deepEqual(event, { ts: TS, kind: "subagent_stop", agent: "unknown", agentId: "a52e" });
});

test("событие без обязательного поля своего вида отклоняется", () => {
  // Arrange
  const log = '{"ts":1,"kind":"prompt"}\n';

  // Act
  const act = () => parseRawLog(log);

  // Assert
  assert.throws(act, RawLogError);
});
