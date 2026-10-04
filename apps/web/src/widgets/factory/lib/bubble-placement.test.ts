import { describe, expect, it } from "vitest";
import { placeBubble } from "./bubble-placement.ts";

const FLOOR = { width: 900, height: 500 };

describe("placeBubble", () => {
  it.each([
    [{ x: 100, y: 100 }, "below", "start"],
    [{ x: 450, y: 100 }, "below", "center"],
    [{ x: 800, y: 400 }, "above", "end"],
  ] as const)("над рабочим в %o раскрывает пузырь: %s, %s", (point, vertical, horizontal) => {
    const placement = placeBubble(point, FLOOR);

    expect(placement).toEqual({ ...point, vertical, horizontal });
  });
});
