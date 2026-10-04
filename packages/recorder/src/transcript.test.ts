import { describe, expect, it } from "vitest";
import { countTokens } from "./transcript.ts";

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
