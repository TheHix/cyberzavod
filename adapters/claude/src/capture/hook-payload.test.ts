import { describe, expect, it } from "vitest";
import { fromHookPayload } from "./hook-payload.ts";

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

  it("сохраняет каталог, в котором выполнялся инструмент", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "make check-web" },
      cwd: "/work/cyberzavod",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "make check-web",
      cwd: "/work/cyberzavod",
    });
  });

  it("сохраняет agent_id вызова сабагента как agentId", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts" },
      cwd: "/work/cyberzavod",
      agent_id: "a52e",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toMatchObject({ kind: "tool", agentId: "a52e" });
  });

  it("не пишет agentId у вызова основной сессии", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts" },
      cwd: "/work/cyberzavod",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).not.toHaveProperty("agentId");
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

  it("сохраняет из ответа сабагента только вердикт — первую строку без оформления и точки", () => {
    const payload = {
      hook_event_name: "SubagentStop",
      agent_type: "reviewer",
      last_assistant_message: "\n**НА ДОРАБОТКУ.**\n\nsrc/a.ts:3 — имя не из предметной области",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "subagent_stop",
      agent: "reviewer",
      verdict: "НА ДОРАБОТКУ",
    });
  });

  it("не принимает за вердикт длинную первую строку ответа", () => {
    const payload = {
      hook_event_name: "SubagentStop",
      agent_type: "general-purpose",
      last_assistant_message: "Нашёл три места, где выбирается модель сабагента, и вот что в них",
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "subagent_stop", agent: "general-purpose" });
  });

  it("превращает отчёт сабагента в сессию в событие с id агента и вердиктом, без текста отчёта", () => {
    const report = [
      '<agent-message from="a68c">',
      "[Subagent hand-back] The text below is the final report. The report follows:",
      "  [harness: пометка среды]",
      "  ",
      "  ДЕФЕКТ",
      "  ",
      "  тест пустого плана падает",
      "</agent-message>",
    ].join("\n");
    const payload = { hook_event_name: "UserPromptSubmit", prompt: report };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "subagent_report", agentId: "a68c", verdict: "ДЕФЕКТ" });
  });

  it("оставляет промптом сообщение агента, которое не отчёт сабагента", () => {
    const text = '<agent-message from="peer">\nПосмотри мой список задач\n</agent-message>';
    const payload = { hook_event_name: "UserPromptSubmit", prompt: text };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "prompt", text });
  });

  it("записывает отчёт сабагента без вердикта, если не нашёл начало отчёта", () => {
    const payload = {
      hook_event_name: "UserPromptSubmit",
      prompt: '<agent-message from="a68c">\n[Subagent hand-back] ПРИНЯТО\n</agent-message>',
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "subagent_report", agentId: "a68c" });
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

  function askPayload(patch: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      hook_event_name: "PostToolUse",
      tool_name: "AskUserQuestion",
      tool_input: { questions: [{ question: "Какой кэш?", options: [] }] },
      tool_response: { answers: { "Какой кэш?": "Без кэша", "Где хранить?": "В памяти" } },
      ...patch,
    };
  }

  it("пишет ответ на AskUserQuestion текстом вопросов и ответов", () => {
    const payload = askPayload();

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({
      ts: TS,
      kind: "question_answer",
      text: "Какой кэш? — Без кэша\nГде хранить? — В памяти",
    });
  });

  it("берёт ответы из входа инструмента, если в ответе их нет", () => {
    const payload = askPayload({
      tool_input: { answers: { "Какой кэш?": "Без кэша" } },
      tool_response: "User has answered",
    });

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "question_answer", text: "Какой кэш? — Без кэша" });
  });

  it("сохраняет сабагента, который задал вопрос", () => {
    const payload = askPayload({ agent_id: "a1" });

    const event = fromHookPayload(payload, TS);

    expect(event).toMatchObject({ kind: "question_answer", agentId: "a1" });
  });

  it.each([
    ["нет ответов", { tool_response: {} }],
    ["ответ не объект", { tool_response: { answers: "Без кэша" } }],
    ["ответы не строки", { tool_response: { answers: { "Какой кэш?": 5 } } }],
    ["ответы пустые", { tool_response: { answers: { "Какой кэш?": " " } } }],
    ["ответ строкой", { tool_response: "User has answered your questions" }],
  ])("без ответов оставляет AskUserQuestion вызовом инструмента: %s", (_name, patch) => {
    const payload = askPayload({ tool_input: { questions: [] }, ...patch });

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "tool", tool: "AskUserQuestion", ok: true });
  });
});

describe("fromHookPayload: ответы чужих инструментов", () => {
  it("не принимает за ответ человека поле answers у другого инструмента", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_response: { answers: { "Какой кэш?": "Без кэша" } },
    };

    const event = fromHookPayload(payload, TS);

    expect(event).toEqual({ ts: TS, kind: "tool", tool: "Bash", ok: true });
  });
});
