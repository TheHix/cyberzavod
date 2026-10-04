import { test } from "node:test";
import assert from "node:assert/strict";
import { countTokens } from "./transcript.ts";

function assistantLine(id: string, usage: Record<string, number>): string {
  return JSON.stringify({ type: "assistant", message: { id, usage } });
}

test("токены сообщений складываются без чтений из кеша", () => {
  // Arrange
  const transcript = [
    JSON.stringify({ type: "user", message: { content: "привет" } }),
    assistantLine("m1", { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 100, cache_read_input_tokens: 5000 }),
    assistantLine("m2", { input_tokens: 1, output_tokens: 2 }),
  ].join("\n");

  // Act
  const tokens = countTokens(transcript);

  // Assert
  assert.equal(tokens, 133);
});

test("повторы одного сообщения считаются один раз по последнему варианту", () => {
  // Arrange
  const transcript = [
    assistantLine("m1", { input_tokens: 10, output_tokens: 5 }),
    assistantLine("m1", { input_tokens: 10, output_tokens: 50 }),
  ].join("\n");

  // Act
  const tokens = countTokens(transcript);

  // Assert
  assert.equal(tokens, 60);
});

test("непонятные строки пропускаются", () => {
  // Arrange
  const transcript = ["не json", "{}", '{"message":"строка"}', assistantLine("m1", { output_tokens: 7 })].join("\n");

  // Act
  const tokens = countTokens(transcript);

  // Assert
  assert.equal(tokens, 7);
});
