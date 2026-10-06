import {
  FACTORY_LAYOUTS,
  PORTRAIT_LAYOUT,
  STAGES,
  WIDE_LAYOUT,
  type FactoryLayout,
} from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { fitPixelPlan, planBounds, type PlanBounds } from "./bounds.ts";
import { plaqueSize } from "./glyphs.ts";
import { MACHINE_SIZE } from "./machines.ts";
import { plaquePlacements, plaqueRect } from "./plaques.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

// Рисунок встаёт на целый пиксель, а ожидание в единицах плана — нет: допуск в полпикселя.
const SLACK = 0.5 / PIXELS_PER_UNIT;
const RESOLUTIONS = [1, 1.5, 2, 3];

function contains(bounds: PlanBounds, rect: PlanBounds): boolean {
  return (
    rect.x >= bounds.x - SLACK &&
    rect.y >= bounds.y - SLACK &&
    rect.x + rect.width <= bounds.x + bounds.width + SLACK &&
    rect.y + rect.height <= bounds.y + bounds.height + SLACK
  );
}

function unitsOf(rect: PlanBounds | undefined): PlanBounds {
  const { x = NaN, y = NaN, width = NaN, height = NaN } = rect ?? {};
  return {
    x: x / PIXELS_PER_UNIT,
    y: y / PIXELS_PER_UNIT,
    width: width / PIXELS_PER_UNIT,
    height: height / PIXELS_PER_UNIT,
  };
}

function rectAround(center: { x: number; y: number }, width: number, height: number): PlanBounds {
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

function machineRect(center: { x: number; y: number }): PlanBounds {
  return rectAround(
    center,
    MACHINE_SIZE.width / PIXELS_PER_UNIT,
    MACHINE_SIZE.height / PIXELS_PER_UNIT,
  );
}

function spotRect(center: { x: number; y: number }): PlanBounds {
  return rectAround(center, 1, 1);
}

// Что обязано попасть в кадр: станки и стол, места рабочих и мастера, дверь.
function neededRects(layout: FactoryLayout): PlanBounds[] {
  const stations = STAGES.map((stage) => layout.stations[stage]);
  return [
    ...stations.map((station) => machineRect(station.machine)),
    ...stations.map((station) => spotRect(station.post)),
    ...stations.map((station) => spotRect(station.foremanPost)),
    machineRect(layout.foreman.desk),
    spotRect(layout.foreman.post),
    spotRect(layout.foreman.door),
  ];
}

function widestPlaqueText(): string {
  return [...Object.values(STAGE_LABELS), FOREMAN_LABEL].reduce((widest, text) =>
    plaqueSize(widest).width >= plaqueSize(text).width ? widest : text,
  );
}

describe("planBounds", () => {
  it.each(FACTORY_LAYOUTS)(
    "включает станки, места, дверь и таблички (план $width×$height)",
    (layout) => {
      const needed = neededRects(layout);

      const bounds = planBounds(layout);

      expect(needed.filter((rect) => !contains(bounds, rect))).toEqual([]);
    },
  );

  it.each(FACTORY_LAYOUTS)("включает самую широкую табличку (план $width×$height)", (layout) => {
    const widest = widestPlaqueText();
    const placement = plaquePlacements(layout).find(({ text }) => text === widest);
    const rect = placement === undefined ? undefined : plaqueRect(placement);

    const bounds = planBounds(layout);

    expect(rect?.width).toBe(plaqueSize(widest).width);
    expect(contains(bounds, unitsOf(rect))).toBe(true);
  });

  it("не оставляет пустых краёв: границы вплотную к нарисованному", () => {
    const wide = planBounds(WIDE_LAYOUT);

    expect(wide.x).toBeGreaterThan(0);
    expect(wide.x + wide.width).toBeLessThan(WIDE_LAYOUT.width);
  });

  it("расширяет границы, если место мастера вынесено вправо за станки", () => {
    const { review } = WIDE_LAYOUT.stations;
    const layout = {
      ...WIDE_LAYOUT,
      stations: { ...WIDE_LAYOUT.stations, review: { ...review, foremanPost: { x: 30, y: 6.1 } } },
    };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(30.5);
  });

  it("расширяет границы, если дверь вынесена за кабинет", () => {
    const layout = { ...WIDE_LAYOUT, foreman: { ...WIDE_LAYOUT.foreman, door: { x: 20, y: 7.4 } } };

    const bounds = planBounds(layout);

    expect(bounds.x + bounds.width).toBeCloseTo(20.5);
  });
});

describe("fitPixelPlan", () => {
  const bounds = planBounds(WIDE_LAYOUT);
  const portraitBounds = planBounds(PORTRAIT_LAYOUT);

  it.each(RESOLUTIONS)(
    "берёт целый множитель пикселей устройства при плотности %s",
    (resolution) => {
      const field = { x: 0, y: 0, width: 900, height: 700 };

      const { scale } = fitPixelPlan(bounds, field, resolution);

      const multiplier = (scale * resolution) / PIXELS_PER_UNIT;
      expect(multiplier).toBeCloseTo(Math.round(multiplier));
      expect(Math.round(multiplier)).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(RESOLUTIONS)("вмещает нарисованное в поле при плотности %s", (resolution) => {
    const field = { x: 40, y: 60, width: 900, height: 700 };

    const { scale, offset } = fitPixelPlan(bounds, field, resolution);

    const half = 0.5 / resolution;
    expect(offset.x + bounds.x * scale).toBeGreaterThanOrEqual(field.x - half);
    expect(offset.y + bounds.y * scale).toBeGreaterThanOrEqual(field.y - half);
    expect(offset.x + (bounds.x + bounds.width) * scale).toBeLessThanOrEqual(
      field.x + field.width + half,
    );
    expect(offset.y + (bounds.y + bounds.height) * scale).toBeLessThanOrEqual(
      field.y + field.height + half,
    );
  });

  it.each(RESOLUTIONS)(
    "ставит сдвиг в целых пикселях устройства при плотности %s",
    (resolution) => {
      const field = { x: 13, y: 7, width: 777, height: 555 };

      const { offset } = fitPixelPlan(portraitBounds, field, resolution);

      expect(offset.x * resolution).toBeCloseTo(Math.round(offset.x * resolution));
      expect(offset.y * resolution).toBeCloseTo(Math.round(offset.y * resolution));
    },
  );

  it("ставит план по центру поля", () => {
    const field = { x: 100, y: 50, width: 1200, height: 800 };

    const { scale, offset } = fitPixelPlan(bounds, field, 1);

    const left = offset.x + bounds.x * scale - field.x;
    const right = field.x + field.width - (offset.x + (bounds.x + bounds.width) * scale);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it("берёт множитель 1 на крошечном поле", () => {
    const field = { x: 0, y: 0, width: 50, height: 40 };

    const { scale } = fitPixelPlan(bounds, field, 2);

    expect(scale).toBe(PIXELS_PER_UNIT / 2);
  });

  it("берёт множитель 4 на поле десктопа при плотности 1", () => {
    // Около 1000×800 остаётся от окна 1440×900 между меню слева и HUD справа.
    const field = { x: 0, y: 0, width: 1000, height: 800 };

    const { scale } = fitPixelPlan(bounds, field, 1);

    expect(scale).toBe(4 * PIXELS_PER_UNIT);
  });
});
