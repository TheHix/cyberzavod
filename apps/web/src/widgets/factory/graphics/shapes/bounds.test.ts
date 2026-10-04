import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@cyberzavod/core";
import { fitPlan, OUTLINE_SLACK, planBounds } from "./bounds.ts";
import { PAD_HALF_WIDTH } from "./floor.ts";
import { PLAQUE_REACH } from "./machines.ts";
import { UNIT } from "./units.ts";

describe("planBounds", () => {
  it("охватывает площадки станков по бокам и таблички сверху и снизу", () => {
    const marginX = PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK;
    const marginY = PLAQUE_REACH / UNIT + OUTLINE_SLACK;

    const bounds = planBounds(DEFAULT_LAYOUT);

    // Крайние станки — на x 3 и 13, ряды станков — на y 1,6 и 7,4.
    expect(bounds).toEqual({
      x: expect.closeTo(3 - marginX),
      y: expect.closeTo(1.6 - marginY),
      width: expect.closeTo(10 + marginX * 2),
      height: expect.closeTo(5.8 + marginY * 2),
    });
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
