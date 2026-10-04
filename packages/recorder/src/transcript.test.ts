import { describe, expect, it } from "vitest";
import { countTokens, modelReplies } from "./transcript.ts";

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
