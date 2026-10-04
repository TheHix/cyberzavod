import { describe, expect, it } from "vitest";
import { placeBubble } from "./bubble-placement.ts";

// Поле начинается не от края экрана: слева меню, справа HUD.
const FIELD = { x: 100, y: 0, width: 900, height: 500 };

describe("placeBubble", () => {
  it.each([
    [{ x: 200, y: 100 }, "below", "start"],
    [{ x: 550, y: 100 }, "below", "center"],
    [{ x: 900, y: 400 }, "above", "end"],
  ] as const)("над рабочим в %o раскрывает пузырь: %s, %s", (point, vertical, horizontal) => {
    const placement = placeBubble(point, FIELD);

    expect(placement).toEqual({ ...point, vertical, horizontal });
  });

  it("меряет середину от верха поля, а не экрана — на телефоне меню сверху", () => {
    const field = { x: 0, y: 200, width: 400, height: 400 };

    const placement = placeBubble({ x: 200, y: 350 }, field);

    expect(placement.vertical).toBe("below");
  });
});
