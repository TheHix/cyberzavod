import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatTokens } from "./format.ts";

test("длительность меньше минуты — только секунды", () => {
  // Act
  const result = formatDuration(42_400);

  // Assert
  assert.equal(result, "42 с");
});

test("длительность с минутами — секунды с ведущим нулём", () => {
  // Act
  const result = formatDuration(125_000);

  // Assert
  assert.equal(result, "2 мин 05 с");
});

test("59,6 с округляются до целой минуты, а не до «60 с»", () => {
  // Act
  const result = formatDuration(59_600);

  // Assert
  assert.equal(result, "1 мин 00 с");
});

test("токены разбиваются по разрядам", () => {
  // Act
  const result = formatTokens(1_234_567);

  // Assert: Intl ставит неразрывные пробелы, сравниваем с обычными
  assert.equal(result.replace(/\s/g, " "), "1 234 567");
});
