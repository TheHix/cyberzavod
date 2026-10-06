import { describe, expect, it } from "vitest";
import { PORTRAIT_LAYOUT, WIDE_LAYOUT } from "@cyberzavod/core";
import { fitPlan, OUTLINE_SLACK, planBounds } from "./bounds.ts";
import { ACTOR_REACH, WORKER_SIZE } from "./actors.ts";
import { PAD_HALF_WIDTH, PAD_MARGIN } from "./floor.ts";
import { PLAQUE_REACH } from "./machines.ts";
import { UNIT } from "./units.ts";

const MARGIN_X = PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK;
const MARGIN_PLAQUE = PLAQUE_REACH / UNIT + OUTLINE_SLACK;
const MARGIN_PAD = PAD_MARGIN / UNIT + OUTLINE_SLACK;
const MARGIN_ACTOR = ACTOR_REACH / UNIT + OUTLINE_SLACK;

describe("planBounds", () => {
  it("охватывает площадки станков по бокам, таблички сверху и снизу, место мастера по фигуре", () => {
    const bounds = planBounds(WIDE_LAYOUT);

    // Крайний станок слева — на x 3, крайнее место мастера справа — на x 14,5 (13 + 1,5),
    // ряды станков — на y 1,6 и 7,4.
    expect(bounds).toEqual({
      x: expect.closeTo(3 - MARGIN_X),
      y: expect.closeTo(1.6 - MARGIN_PLAQUE),
      width: expect.closeTo(14.5 + MARGIN_ACTOR - (3 - MARGIN_X)),
      height: expect.closeTo(5.8 + MARGIN_PLAQUE * 2),
    });
  });

  it("охватывает портретный план: два столбца станков и кабинет внизу", () => {
    const bounds = planBounds(PORTRAIT_LAYOUT);

    // Столбцы станков — на x 1,5 и 5,5; верхний станок — на y 1,6, нижнее место мастера — на y 9,9.
    expect(bounds).toEqual({
      x: expect.closeTo(1.5 - MARGIN_X),
      y: expect.closeTo(1.6 - MARGIN_PLAQUE),
      width: expect.closeTo(4 + MARGIN_X * 2),
      height: expect.closeTo(9.9 + MARGIN_ACTOR - (1.6 - MARGIN_PLAQUE)),
    });
  });

  it("считает отступ места рабочего по площадке, а не по табличке", () => {
    const layout = {
      ...WIDE_LAYOUT,
      stations: {
        ...WIDE_LAYOUT.stations,
        spec: { ...WIDE_LAYOUT.stations.spec, post: { x: 3, y: -10 } },
      },
    };

    const bounds = planBounds(layout);

    expect(bounds.y).toBeCloseTo(-10 - MARGIN_PAD);
  });
});

describe("planBounds: кабинет мастера", () => {
  it("включает стол, место и дверь мастера в плане по умолчанию", () => {
    const { desk, post, door } = WIDE_LAYOUT.foreman;

    const bounds = planBounds(WIDE_LAYOUT);

    for (const point of [desk, post, door]) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x + MARGIN_ACTOR);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y);
      expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width - MARGIN_ACTOR);
      expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it("расширяет границы, если кабинет вынесен за ряд станков", () => {
    const layout = {
      ...WIDE_LAYOUT,
      foreman: {
        desk: { x: -4, y: 6.3 },
        post: { x: -4, y: 7.4 },
        door: { x: -2.5, y: 7.4 },
        facing: 0,
      },
    };

    const bounds = planBounds(layout);

    expect(bounds.x).toBeCloseTo(-4 - MARGIN_X);
  });

  it("расширяет границы по фигуре, если дверь вынесена за кабинет", () => {
    const layout = {
      ...WIDE_LAYOUT,
      foreman: { ...WIDE_LAYOUT.foreman, door: { x: 20, y: 7.4 } },
    };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(20 + MARGIN_ACTOR);
  });
});

describe("planBounds: место мастера у станка", () => {
  it("расширяет границы по фигуре, если место мастера вынесено вправо за станки", () => {
    const { review } = WIDE_LAYOUT.stations;
    const layout = {
      ...WIDE_LAYOUT,
      stations: {
        ...WIDE_LAYOUT.stations,
        review: { ...review, foremanPost: { x: 30, y: 6.1 } },
      },
    };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(30 + MARGIN_ACTOR);
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

describe("fitPlan: портретный план на телефоне", () => {
  it("делает рабочего не меньше 28 пикселей", () => {
    // Телефон 375×812: поле шириной 351 (375 − 2×12) и высотой 487 — это 812 минус меню
    // и отступы (101), отступ снизу (24) и HUD не выше 200.
    const field = { x: 0, y: 0, width: 351, height: 487 };

    const { scale } = fitPlan(planBounds(PORTRAIT_LAYOUT), field);

    expect((scale * WORKER_SIZE) / UNIT).toBeGreaterThanOrEqual(28);
  });
});
