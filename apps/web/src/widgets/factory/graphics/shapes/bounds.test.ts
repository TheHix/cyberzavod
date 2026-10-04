import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@cyberzavod/core";
import { fitPlan, OUTLINE_SLACK, planBounds } from "./bounds.ts";
import { PAD_HALF_WIDTH } from "./floor.ts";
import { PLAQUE_REACH } from "./machines.ts";
import { UNIT } from "./units.ts";

describe("planBounds", () => {
  it("охватывает площадки станков и места мастера по бокам и таблички сверху и снизу", () => {
    const marginX = PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK;
    const marginY = PLAQUE_REACH / UNIT + OUTLINE_SLACK;

    const bounds = planBounds(DEFAULT_LAYOUT);

    // Крайний станок слева — на x 3, крайнее место мастера справа — на x 14,5 (13 + 1,5),
    // ряды станков — на y 1,6 и 7,4.
    expect(bounds).toEqual({
      x: expect.closeTo(3 - marginX),
      y: expect.closeTo(1.6 - marginY),
      width: expect.closeTo(11.5 + marginX * 2),
      height: expect.closeTo(5.8 + marginY * 2),
    });
  });
});

describe("planBounds: кабинет мастера", () => {
  const marginX = PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK;

  it("включает стол, место и дверь мастера в плане по умолчанию", () => {
    const { desk, post, door } = DEFAULT_LAYOUT.foreman;

    const bounds = planBounds(DEFAULT_LAYOUT);

    for (const point of [desk, post, door]) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x + marginX);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y);
      expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width - marginX);
      expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it("расширяет границы, если кабинет вынесен за ряд станков", () => {
    const layout = {
      ...DEFAULT_LAYOUT,
      foreman: {
        desk: { x: -4, y: 6.3 },
        post: { x: -4, y: 7.4 },
        door: { x: -2.5, y: 7.4 },
        facing: 0,
      },
    };

    const bounds = planBounds(layout);

    expect(bounds.x).toBeCloseTo(-4 - marginX);
  });

  it("расширяет границы, если дверь вынесена за кабинет", () => {
    const layout = {
      ...DEFAULT_LAYOUT,
      foreman: { ...DEFAULT_LAYOUT.foreman, door: { x: 20, y: 7.4 } },
    };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(20 + marginX);
  });
});

describe("planBounds: место мастера у станка", () => {
  const marginX = PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK;

  it("расширяет границы, если место мастера вынесено вправо за станки", () => {
    const { review } = DEFAULT_LAYOUT.stations;
    const layout = {
      ...DEFAULT_LAYOUT,
      stations: {
        ...DEFAULT_LAYOUT.stations,
        review: { ...review, foremanPost: { x: 30, y: 6.1 } },
      },
    };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(30 + marginX);
  });
});

describe("fitPlan", () => {
  it("вписывает план по меньшей стороне и ставит его по центру поля", () => {
    const bounds = { x: 1, y: 0, width: 10, height: 5 };
    const field = { x: 100, y: 50, width: 400, height: 400 };

    const fit = fitPlan(bounds, field);

    // 40 пикселей на единицу; по вертикали остаётся 200 — по 100 сверху и снизу.
    expect(fit).toEqual({ scale: 40, offset: { x: 60, y: 150 } });
  });
});
