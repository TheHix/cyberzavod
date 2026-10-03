import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatTokens } from "./format.ts";

test("длительность меньше минуты — только секунды", () => {
  assert.equal(formatDuration(42_400), "42 с");
});

test("длительность с минутами — секунды с ведущим нулём", () => {
  assert.equal(formatDuration(125_000), "2 мин 05 с");
});

test("59,6 с округляются до целой минуты, а не до «60 с»", () => {
  assert.equal(formatDuration(59_600), "1 мин 00 с");
});

test("токены разбиваются по разрядам", () => {
  assert.equal(formatTokens(1_234_567).replace(/\s/g, " "), "1 234 567");
});
