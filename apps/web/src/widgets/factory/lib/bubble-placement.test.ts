import { describe, expect, it } from "vitest";
import { bubbleLeftOf, placeBubble, verticalRoomOf } from "./bubble-placement.ts";

// The field does not start at the screen edge: the menu is on the left, the HUD on the right.
const FIELD = { x: 100, y: 0, width: 900, height: 500 };

// A narrow field of the wide layout: a window of about 800 px, the menu on the left and the HUD on
// the right ate almost all of it.
const NARROW_FIELD = { x: 152, y: 20, width: 228, height: 620 };

describe("verticalRoomOf", () => {
  it.each([
    ["above", 120],
    ["below", 380],
  ] as const)("от точки до края поля в сторону %s — %d px", (side, expected) => {
    const room = verticalRoomOf({ x: 500, y: 120 }, FIELD, side);

    expect(room).toBe(expected);
  });

  it("меряет от краёв поля, а не экрана — на телефоне меню сверху", () => {
    const field = { x: 0, y: 200, width: 400, height: 400 };

    const room = verticalRoomOf({ x: 200, y: 350 }, field, "above");

    expect(room).toBe(150);
  });

  it("не оставляет места в сторону, где точка уже за краем поля", () => {
    const room = verticalRoomOf({ x: 500, y: -30 }, FIELD, "above");

    expect(room).toBe(0);
  });
});

describe("placeBubble", () => {
  it.each([
    [{ x: 200, y: 100 }, "below", 400],
    [{ x: 900, y: 400 }, "above", 400],
  ] as const)("над рабочим в %o раскрывает пузырь %s, места %d px", (point, vertical, height) => {
    const placement = placeBubble(point, FIELD);

    expect(placement).toEqual({ ...point, vertical, roomHeight: height });
  });

  it("ставит точку пузыря в целые пиксели", () => {
    const placement = placeBubble({ x: 200.4, y: 100.6 }, FIELD);

    expect({ x: placement.x, y: placement.y }).toEqual({ x: 200, y: 101 });
  });

  it("раскрывает пузырь туда, где до края поля больше места", () => {
    const placement = placeBubble({ x: 550, y: 260 }, FIELD);

    expect({ vertical: placement.vertical, roomHeight: placement.roomHeight }).toEqual({
      vertical: "above",
      roomHeight: 260,
    });
  });

  it("меряет место от верха поля, а не экрана — на телефоне меню сверху", () => {
    const field = { x: 0, y: 200, width: 400, height: 400 };

    const placement = placeBubble({ x: 200, y: 350 }, field);

    expect({ vertical: placement.vertical, roomHeight: placement.roomHeight }).toEqual({
      vertical: "below",
      roomHeight: 250,
    });
  });
});

describe("bubbleLeftOf", () => {
  it("ставит пузырь серединой над говорящим, когда он помещается в поле", () => {
    const left = bubbleLeftOf(500, 200, FIELD);

    expect(left).toBe(-100);
  });

  it.each([
    ["левому", 150, -50],
    ["правому", 950, -150],
  ] as const)("у края поля прижимает пузырь к %s краю", (_edge, anchorX, expected) => {
    const left = bubbleLeftOf(anchorX, 200, FIELD);

    expect(left).toBe(expected);
  });

  it("в узком поле держит пузырь шириной с поле в его краях", () => {
    const left = bubbleLeftOf(315, NARROW_FIELD.width, NARROW_FIELD);

    expect(left).toBe(NARROW_FIELD.x - 315);
  });

  it("пузырь шире поля прижимает к левому краю", () => {
    const left = bubbleLeftOf(500, 1000, FIELD);

    expect(left).toBe(-400);
  });
});
