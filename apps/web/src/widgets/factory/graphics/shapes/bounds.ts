// Границы нарисованного цеха в единицах плана: станки, места рабочих и мастера, кабинет
// мастера с дверью, площадки и таблички.
// По ним план вписывается в поле — без пустых краёв, которые есть у плана целиком.

import { STAGES, type FactoryLayout, type Point } from "@cyberzavod/core";
import type { Frame, ScreenPoint } from "../factory-graphics.ts";
import { ACTOR_REACH } from "./actors.ts";
import { PAD_HALF_WIDTH, PAD_MARGIN } from "./floor.ts";
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

// Насколько от точки уходит нарисованное: у каждого вида точки — своё.
interface Reach {
  readonly x: number;
  readonly y: number;
}

// Станок и стол: по горизонтали — площадка, по вертикали — табличка по другую сторону.
const FURNITURE_REACH: Reach = {
  x: PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK,
  y: PLAQUE_REACH / UNIT + OUTLINE_SLACK,
};
// Место рабочего: по горизонтали — площадка, по вертикали — её поле за рабочим.
const WORKER_POST_REACH: Reach = {
  x: PAD_HALF_WIDTH / UNIT + OUTLINE_SLACK,
  y: PAD_MARGIN / UNIT + OUTLINE_SLACK,
};
// Мастер вне площадки и дверь: рисуется только фигура со своей тенью.
const ACTOR_SPOT_REACH: Reach = {
  x: ACTOR_REACH / UNIT + OUTLINE_SLACK,
  y: ACTOR_REACH / UNIT + OUTLINE_SLACK,
};

interface ReachedPoint {
  readonly point: Point;
  readonly reach: Reach;
}

function reachedBy(reach: Reach, points: readonly Point[]): ReachedPoint[] {
  return points.map((point) => ({ point, reach }));
}

/**
 * Считает, какую часть плана занимает нарисованный цех.
 * @param {FactoryLayout} layout План цеха.
 * @returns {PlanBounds} Прямоугольник, который надо вписать в поле.
 */
export function planBounds(layout: FactoryLayout): PlanBounds {
  const stations = STAGES.map((stage) => layout.stations[stage]);
  const { desk, post, door } = layout.foreman;
  const reached = [
    ...reachedBy(
      FURNITURE_REACH,
      stations.map(({ machine }) => machine),
    ),
    ...reachedBy(FURNITURE_REACH, [desk, post]),
    ...reachedBy(
      WORKER_POST_REACH,
      stations.map((station) => station.post),
    ),
    ...reachedBy(
      ACTOR_SPOT_REACH,
      stations.map((station) => station.foremanPost),
    ),
    ...reachedBy(ACTOR_SPOT_REACH, [door]),
  ];
  const left = Math.min(...reached.map(({ point, reach }) => point.x - reach.x));
  const top = Math.min(...reached.map(({ point, reach }) => point.y - reach.y));
  const right = Math.max(...reached.map(({ point, reach }) => point.x + reach.x));
  const bottom = Math.max(...reached.map(({ point, reach }) => point.y + reach.y));
  return { x: left, y: top, width: right - left, height: bottom - top };
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
