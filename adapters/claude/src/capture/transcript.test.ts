import { describe, expect, it } from "vitest";
import {
  agentAssignments,
  agentReports,
  assistantTexts,
  countTokens,
  modelReplies,
  tokenUsages,
} from "./transcript.ts";

function assistantLine(id: string, usage: Record<string, number>): string {
  return JSON.stringify({ type: "assistant", message: { id, usage } });
}

describe("countTokens", () => {
  it("складывает токены сообщений без чтений из кеша", () => {
    const transcript = [
      JSON.stringify({ type: "user", message: { content: "привет" } }),
      assistantLine("m1", {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 5000,
      }),
      assistantLine("m2", { input_tokens: 1, output_tokens: 2 }),
    ].join("\n");

    const tokens = countTokens(transcript);

    expect(tokens).toBe(133);
  });

  it("считает повторы одного сообщения один раз по последнему варианту", () => {
    const transcript = [
      assistantLine("m1", { input_tokens: 10, output_tokens: 5 }),
      assistantLine("m1", { input_tokens: 10, output_tokens: 50 }),
    ].join("\n");

    const tokens = countTokens(transcript);

    expect(tokens).toBe(60);
  });

  it("пропускает непонятные строки", () => {
    const transcript = [
      "не json",
      "{}",
      '{"message":"строка"}',
      assistantLine("m1", { output_tokens: 7 }),
    ].join("\n");

    const tokens = countTokens(transcript);

    expect(tokens).toBe(7);
  });
});

function timedAssistantLine(id: string, second: number, usage: Record<string, number>): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: `2026-10-04T10:00:${String(second).padStart(2, "0")}.000Z`,
    message: { id, usage },
  });
}

describe("tokenUsages", () => {
  it("даёт токены каждого сообщения: последний вариант и время последней части", () => {
    const transcript = [
      timedAssistantLine("m1", 1, { input_tokens: 10, output_tokens: 5 }),
      timedAssistantLine("m2", 4, { output_tokens: 7, cache_read_input_tokens: 9_000 }),
      timedAssistantLine("m1", 3, { input_tokens: 10, output_tokens: 50 }),
    ].join("\n");

    const usages = tokenUsages(transcript);

    expect(usages).toEqual([
      { ts: Date.parse("2026-10-04T10:00:03.000Z"), tokens: 60 },
      { ts: Date.parse("2026-10-04T10:00:04.000Z"), tokens: 7 },
    ]);
  });

  it("даёт в сумме столько же, сколько countTokens", () => {
    const transcript = [
      timedAssistantLine("m1", 1, { input_tokens: 10, cache_creation_input_tokens: 100 }),
      timedAssistantLine("m2", 2, { output_tokens: 20 }),
      timedAssistantLine("m2", 3, { output_tokens: 25 }),
    ].join("\n");

    const usages = tokenUsages(transcript);

    expect(usages.reduce((sum, { tokens }) => sum + tokens, 0)).toBe(countTokens(transcript));
  });

  it("пропускает сообщения без времени", () => {
    const transcript = [
      assistantLine("m1", { output_tokens: 7 }),
      timedAssistantLine("m2", 2, { output_tokens: 3 }),
    ].join("\n");

    const usages = tokenUsages(transcript);

    expect(usages.map(({ tokens }) => tokens)).toEqual([3]);
  });
});

function replyLine(timestamp: string, model: string): string {
  return JSON.stringify({ type: "assistant", timestamp, message: { id: timestamp, model } });
}

describe("modelReplies", () => {
  it("собирает ответы моделей по времени без служебных", () => {
    const transcript = [
      replyLine("2026-10-04T10:00:05.000Z", "claude-sonnet-5-5"),
      replyLine("2026-10-04T10:00:01.000Z", "claude-opus-5-5"),
      replyLine("2026-10-04T10:00:03.000Z", "<synthetic>"),
      JSON.stringify({ type: "user", timestamp: "2026-10-04T10:00:00.000Z", message: {} }),
      "не json",
    ].join("\n");

    const replies = modelReplies(transcript);

    expect(replies).toEqual([
      { ts: Date.parse("2026-10-04T10:00:01.000Z"), model: "claude-opus-5-5" },
      { ts: Date.parse("2026-10-04T10:00:05.000Z"), model: "claude-sonnet-5-5" },
    ]);
  });
});

const timestampAt = (second: number) => `2026-10-04T10:00:${String(second).padStart(2, "0")}.000Z`;

interface EntryPatch {
  uuid: string;
  second: number;
  messageId?: string;
  model?: string;
  agentId?: string;
}

function assistantEntry(patch: EntryPatch, content: unknown[]): string {
  const { uuid, second, messageId = uuid, model = "claude-opus-5-5", agentId } = patch;

  return JSON.stringify({
    type: "assistant",
    uuid,
    timestamp: timestampAt(second),
    ...(agentId === undefined ? {} : { agentId }),
    message: { id: messageId, model, content },
  });
}

function userEntry(patch: Pick<EntryPatch, "uuid" | "second" | "agentId">, content: unknown) {
  const { uuid, second, agentId } = patch;

  return JSON.stringify({
    type: "user",
    uuid,
    timestamp: timestampAt(second),
    ...(agentId === undefined ? {} : { agentId }),
    message: { role: "user", content },
  });
}

const text = (value: string) => ({ type: "text", text: value });
const toolUse = (name: string, input: Record<string, unknown>, id?: string) => ({
  type: "tool_use",
  name,
  input,
  ...(id === undefined ? {} : { id }),
});

// Environment response to a tool call: a user entry with a tool_result block and the tool result.
function toolResultEntry(uuid: string, second: number, callId: string, result: unknown): string {
  return JSON.stringify({
    type: "user",
    uuid,
    timestamp: timestampAt(second),
    toolUseResult: result,
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: callId }] },
  });
}

describe("assistantTexts", () => {
  it("склеивает текстовые блоки одного ответа через пустую строку и берёт время последнего", () => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 1, messageId: "m1" }, [text("Первый абзац.")]),
      assistantEntry({ uuid: "a2", second: 2, messageId: "m1" }, [toolUse("Read", {})]),
      assistantEntry({ uuid: "a3", second: 3, messageId: "m1" }, [text("Второй абзац.")]),
    ].join("\n");

    const texts = assistantTexts(transcript);

    expect(texts).toEqual([
      { ts: Date.parse(timestampAt(3)), text: "Первый абзац.\n\nВторой абзац." },
    ]);
  });

  it("не дублирует запись, которая попала в файл дважды", () => {
    const line = assistantEntry({ uuid: "a1", second: 1, messageId: "m1" }, [text("Готово.")]);
    const transcript = [line, line].join("\n");

    const texts = assistantTexts(transcript);

    expect(texts).toEqual([{ ts: Date.parse(timestampAt(1)), text: "Готово." }]);
  });

  it("пропускает служебные ответы, мысли и пустые тексты", () => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 1, model: "<synthetic>" }, [text("Лимит сессии")]),
      assistantEntry({ uuid: "a2", second: 2 }, [{ type: "thinking", thinking: "думаю" }]),
      assistantEntry({ uuid: "a3", second: 3 }, [text("  ")]),
      userEntry({ uuid: "u1", second: 4 }, "вопрос человека"),
      "не json",
    ].join("\n");

    const texts = assistantTexts(transcript);

    expect(texts).toEqual([]);
  });

  it("отдаёт ответы по времени", () => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 9 }, [text("Позже")]),
      assistantEntry({ uuid: "a2", second: 2 }, [text("Раньше")]),
    ].join("\n");

    const texts = assistantTexts(transcript);

    expect(texts.map((answer) => answer.text)).toEqual(["Раньше", "Позже"]);
  });
});

describe("agentAssignments", () => {
  it("находит задание новому сабагенту и сообщение уже работающему", () => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 1 }, [
        toolUse("Agent", { subagent_type: "coder", prompt: "Сделай задачу" }),
      ]),
      assistantEntry({ uuid: "a2", second: 5 }, [
        toolUse("SendMessage", { to: "a8dea51d", message: "Доработай постановку" }),
      ]),
    ].join("\n");

    const assignments = agentAssignments(transcript);

    expect(assignments).toEqual([
      { ts: Date.parse(timestampAt(1)), text: "Сделай задачу", via: "spawn", agentType: "coder" },
      {
        ts: Date.parse(timestampAt(5)),
        text: "Доработай постановку",
        via: "message",
        agentId: "a8dea51d",
      },
    ]);
  });

  it("берёт agentId задания новому сабагенту из результата вызова", () => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 1 }, [
        toolUse("Agent", { subagent_type: "coder", prompt: "Сделай задачу" }, "call-1"),
        toolUse("Agent", { subagent_type: "tester", prompt: "Проверь" }, "call-2"),
      ]),
      toolResultEntry("u1", 2, "call-2", { agentId: "t-7" }),
      toolResultEntry("u2", 3, "call-1", { agentId: "c-3", status: "async_launched" }),
    ].join("\n");

    const assignments = agentAssignments(transcript);

    expect(
      assignments.map((assignment) => assignment.via === "spawn" && assignment.agentId),
    ).toEqual(["c-3", "t-7"]);
  });

  it.each([
    ["нет результата вызова", []],
    ["в результате нет agentId", [toolResultEntry("u1", 2, "call-1", { status: "error" })]],
    ["agentId не строка", [toolResultEntry("u1", 2, "call-1", { agentId: 5 })]],
    ["результат другого вызова", [toolResultEntry("u1", 2, "call-9", { agentId: "x" })]],
  ])("не добавляет agentId заданию, если %s", (_name, results) => {
    const transcript = [
      assistantEntry({ uuid: "a1", second: 1 }, [
        toolUse("Agent", { subagent_type: "coder", prompt: "Сделай задачу" }, "call-1"),
      ]),
      ...results,
    ].join("\n");

    const [assignment] = agentAssignments(transcript);

    expect(assignment).not.toHaveProperty("agentId");
  });

  it("пропускает другие инструменты и сообщения не строкой", () => {
    const transcript = assistantEntry({ uuid: "a1", second: 1 }, [
      toolUse("Bash", { command: "ls" }),
      toolUse("SendMessage", { to: "a1", message: { type: "shutdown_request" } }),
      toolUse("Agent", { prompt: "без типа" }),
    ]);

    const assignments = agentAssignments(transcript);

    expect(assignments).toEqual([]);
  });
});

describe("agentReports", () => {
  const agentId = "a8dea51d";

  it("берёт последнюю сдачу работы инструментом SubagentHandback", () => {
    const transcript = [
      userEntry({ uuid: "u1", second: 1, agentId }, "Поставь задачу"),
      assistantEntry({ uuid: "a1", second: 2, agentId }, [
        toolUse("SubagentHandback", { message: "Черновой отчёт" }),
      ]),
      assistantEntry({ uuid: "a2", second: 3, agentId }, [
        toolUse("SubagentHandback", { message: "ПРИНЯТО\n\nИтоговый отчёт" }),
      ]),
      assistantEntry({ uuid: "a3", second: 4, agentId }, [text("Отчёт передан.")]),
    ].join("\n");

    const reports = agentReports(transcript);

    expect(reports).toEqual([
      { ts: Date.parse(timestampAt(3)), agentId, text: "ПРИНЯТО\n\nИтоговый отчёт" },
    ]);
  });

  it("без сдачи работы берёт последний текст модели в запуске", () => {
    const transcript = [
      userEntry({ uuid: "u1", second: 1, agentId }, "Поставь задачу"),
      assistantEntry({ uuid: "a1", second: 2, agentId }, [text("Начинаю.")]),
      assistantEntry({ uuid: "a2", second: 3, agentId }, [text("Постановка готова.")]),
    ].join("\n");

    const reports = agentReports(transcript);

    expect(reports).toEqual([
      { ts: Date.parse(timestampAt(3)), agentId, text: "Постановка готова." },
    ]);
  });

  it("даёт по отчёту на каждый запуск и не считает вставку среды новым запуском", () => {
    const transcript = [
      userEntry({ uuid: "u1", second: 1, agentId }, "Первое задание"),
      userEntry({ uuid: "u2", second: 1, agentId }, "<system-reminder>\nСдай отчёт"),
      assistantEntry({ uuid: "a1", second: 2, agentId }, [text("Первый отчёт")]),
      userEntry({ uuid: "u3", second: 5, agentId }, "Второй круг: поправь"),
      assistantEntry({ uuid: "a2", second: 6, agentId }, [text("Второй отчёт")]),
    ].join("\n");

    const reports = agentReports(transcript);

    expect(reports.map((report) => report.text)).toEqual(["Первый отчёт", "Второй отчёт"]);
  });

  it("не считает служебное уведомление среды новым запуском", () => {
    const transcript = [
      userEntry({ uuid: "u1", second: 1, agentId }, "Задание"),
      assistantEntry({ uuid: "a1", second: 2, agentId }, [text("Отчёт запуска")]),
      userEntry(
        { uuid: "u2", second: 3, agentId },
        "[SYSTEM NOTIFICATION - NOT USER INPUT] Фоновая задача завершена",
      ),
    ].join("\n");

    const reports = agentReports(transcript);

    expect(reports.map((report) => report.text)).toEqual(["Отчёт запуска"]);
  });

  it("пропускает запуск без отчёта", () => {
    const transcript = userEntry({ uuid: "u1", second: 1, agentId }, "Задание");

    const reports = agentReports(transcript);

    expect(reports).toEqual([]);
  });
});
