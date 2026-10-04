import { describe, expect, it } from "vitest";
import { fromHookPayload, isSafeSessionId, parseRawLog, RawLogError } from "./raw-event.ts";

const TS = 1_000;

describe("fromHookPayload", () => {
  it("превращает промпт пользователя в событие prompt", () => {
    const payload = { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "Сделай цех" };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "prompt", text: "Сделай цех" });
  });

  it("превращает начало сессии в событие session_start", () => {
    const payload = { hook_event_name: "SessionStart", session_id: "s1", source: "startup" };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "session_start" });
  });

  it("сохраняет команду и файл инструмента, но не его ответ", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "make check-web" },
      tool_response: { stdout: "очень длинный вывод" },
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "make check-web",
    });
  });

  it("помечает упавший инструмент как ok: false", () => {
    const payload = {
      hook_event_name: "PostToolUseFailure",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts" },
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "tool", tool: "Edit", ok: false, file: "/a.ts" });
  });

  it("берёт путь блокнота из notebook_path", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "NotebookEdit",
      tool_input: { notebook_path: "/n.ipynb" },
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "tool",
      tool: "NotebookEdit",
      ok: true,
      file: "/n.ipynb",
    });
  });

  it("обрезает длинную команду", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "x".repeat(500) },
    };

    const event = fromHookPayload(payload, TS);

    expect(event?.kind === "tool" ? event.command?.length : undefined).toBe(200);
  });

  it("записывает сабагента без типа как unknown", () => {
    const payload = { hook_event_name: "SubagentStart" };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "subagent_start", agent: "unknown" });
  });

  it("записывает служебного сабагента с пустым типом как unknown и сохраняет его id", () => {
    const payload = { hook_event_name: "SubagentStop", agent_type: "", agent_id: "a52e" };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "subagent_stop", agent: "unknown", agentId: "a52e" });
  });

  it("сохраняет транскрипт остановившегося сабагента", () => {
    const payload = {
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      agent_transcript_path: "/t/agent.jsonl",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "subagent_stop",
      agent: "reviewer",
      transcriptPath: "/t/agent.jsonl",
    });
  });

  it("сохраняет транскрипт сессии при остановке", () => {
    const payload = {
      hook_event_name: "Stop",
      transcript_path: "/t/main.jsonl",
      stop_hook_active: false,
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "stop", transcriptPath: "/t/main.jsonl" });
  });

  it("пропускает событие, ненужное для записи", () => {
    const payload = { hook_event_name: "Notification", message: "жду ввода" };

    const event = fromHookPayload(payload, TS);

    expect(event).toBeNull();
  });
});

describe("isSafeSessionId", () => {
  it("принимает id сессии и отклоняет пути и не-строки", () => {
    const candidates = ["744e7547-d312-42c4-88a0-fd9089104079", "../../evil", "a/b", "", 42];

    const results = candidates.map(isSafeSessionId);

    expect(results).toEqual([true, false, false, false, false]);
  });
});

describe("parseRawLog", () => {
  it("пропускает оборванную строку и читает остальные", () => {
    const log = '{"ts":1,"kind":"session_start"}\n{"ts":2,"kind":"pro\n{"ts":3,"kind":"stop"}\n';

    const events = parseRawLog(log);

    expect(events).toEqual([
      { ts: 1, kind: "session_start" },
      { ts: 3, kind: "stop" },
    ]);
  });

  it("отклоняет строку не той формы с номером строки в ошибке", () => {
    const log = '{"ts":1,"kind":"session_start"}\n{"foo":"bar"}\n';

    const act = () => parseRawLog(log);

    expect(act).toThrow(new RawLogError("строка 2: не событие журнала"));
  });

  it("отклоняет событие без обязательного поля своего вида", () => {
    const log = '{"ts":1,"kind":"prompt"}\n';

    const act = () => parseRawLog(log);

    expect(act).toThrow(RawLogError);
  });
});
