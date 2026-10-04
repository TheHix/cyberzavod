// Границы нарисованного цеха в единицах плана: станки, места рабочих, кабинет мастера,
// площадки и таблички.
// По ним план вписывается в поле — без пустых краёв, которые есть у плана целиком.

import { STAGES, type FactoryLayout } from "@cyberzavod/core";
import type { Frame, ScreenPoint } from "../factory-graphics.ts";
import { PAD_HALF_WIDTH } from "./floor.ts";
import { PLAQUE_REACH } from "./machines.ts";
import { UNIT } from "./units.ts";

/** Прямоугольник в единицах плана. */
export interface PlanBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Как план встаёт в поле: пикселей на единицу плана и где на холсте начало плана. */
export interface PlanFit {
  readonly scale: number;
  readonly offset: ScreenPoint;
}

/** Запас на контур поверх размеров рисунка, единиц плана. */
export const OUTLINE_SLACK = 0.05;

// Запас вокруг станков и мест рабочих берётся из размеров рисунка: по горизонтали —
// площадка станка, по вертикали — табличка по другую сторону станка.
const MARGIN = {
  x: PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK,
  y: PLAQUE_REACH / UNIT + OUTLINE_SLACK,
} as const;

/**
 * Считает, какую часть плана занимает нарисованный цех.
 * @param {FactoryLayout} layout План цеха.
 * @returns {PlanBounds} Прямоугольник, который надо вписать в поле.
 */
export function planBounds(layout: FactoryLayout): PlanBounds {
  const stationPoints = STAGES.flatMap((stage) => {
    const { machine, post } = layout.stations[stage];
    return [machine, post];
  });
  const points = [...stationPoints, layout.conductor.desk, layout.conductor.post];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs) - MARGIN.x;
  const top = Math.min(...ys) - MARGIN.y;
  return {
    x: left,
    y: top,
    width: Math.max(...xs) + MARGIN.x - left,
    height: Math.max(...ys) + MARGIN.y - top,
  };
}

/**
 * Вписывает нарисованный цех в поле целиком и по центру.
 * @param {PlanBounds} bounds Границы нарисованного цеха.
 * @param {Frame} field Поле на холсте, свободное от меню и HUD.
 * @returns {PlanFit} Масштаб и сдвиг плана на холсте.
 */
export function fitPlan(bounds: PlanBounds, field: Frame): PlanFit {
  const scale = Math.min(field.width / bounds.width, field.height / bounds.height);
  return {
    scale,
    offset: {
      x: field.x + (field.width - bounds.width * scale) / 2 - bounds.x * scale,
      y: field.y + (field.height - bounds.height * scale) / 2 - bounds.y * scale,
    },
  };
}
