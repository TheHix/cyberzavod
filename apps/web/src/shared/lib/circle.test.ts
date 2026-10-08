import { describe, expect, it } from "vitest";
import { nextIndexInCircle } from "./circle.ts";

describe("nextIndexInCircle", () => {
  it.each([
    [0, 3, 1],
    [1, 3, 2],
    [2, 3, 0],
    [0, 1, 0],
  ])("после %i из %i идёт %i", (index, count, expected) => {
    const next = nextIndexInCircle(index, count);

    expect(next).toBe(expected);
  });
});
