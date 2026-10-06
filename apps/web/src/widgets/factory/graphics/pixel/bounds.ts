// Границы нарисованного цеха в единицах плана: площадки станков и кабинета, места рабочих
// и мастера, дверь и таблички. По ним план вписывается в поле — без пустых краёв, которые есть
// у плана целиком. Размеры берутся из рисунков, а не подгоняются.

import { STAGES, type FactoryLayout, type Point } from "@cyberzavod/core";
import type { Frame, ScreenPoint } from "../factory-graphics.ts";
import { ACTOR_ART } from "./actors.ts";
import { artSize } from "./art.ts";
import { padRects } from "./floor.ts";
import { plaquePlacements, plaqueRect } from "./plaques.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** Прямоугольник. */
export interface PlanBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Как план встаёт в поле: CSS-пикселей на единицу плана и где на холсте начало плана. */
export interface PlanFit {
  readonly scale: number;
  readonly offset: ScreenPoint;
}

const ACTOR_SIZE = artSize(ACTOR_ART.down.stand);

function unitsOf(rect: PlanBounds): PlanBounds {
  return {
    x: rect.x / PIXELS_PER_UNIT,
    y: rect.y / PIXELS_PER_UNIT,
    width: rect.width / PIXELS_PER_UNIT,
    height: rect.height / PIXELS_PER_UNIT,
  };
}

// Фигура с центром в точке плана: стоит вне площадки, поэтому считается отдельно.
function actorRect(point: Point): PlanBounds {
  return {
    x: Math.round(point.x * PIXELS_PER_UNIT) - ACTOR_SIZE.width / 2,
    y: Math.round(point.y * PIXELS_PER_UNIT) - ACTOR_SIZE.height / 2,
    ...ACTOR_SIZE,
  };
}

/**
 * Считает, какую часть плана занимает нарисованный цех.
 * @param {FactoryLayout} layout План цеха.
 * @returns {PlanBounds} Прямоугольник в единицах плана, который надо вписать в поле.
 */
export function planBounds(layout: FactoryLayout): PlanBounds {
  const rects = [
    ...padRects(layout),
    ...plaquePlacements(layout).map(plaqueRect),
    ...STAGES.map((stage) => actorRect(layout.stations[stage].foremanPost)),
    actorRect(layout.foreman.door),
  ].map(unitsOf);
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Вписывает нарисованный цех в поле целиком и по центру так, чтобы пиксель рисунка занимал
 * целое число пикселей устройства: край спрайта не попадает между ними и остаётся резким.
 * @param {PlanBounds} bounds Границы нарисованного цеха в единицах плана.
 * @param {Frame} field Поле на холсте, свободное от меню и HUD, CSS-пиксели.
 * @param {number} resolution Пикселей устройства в CSS-пикселе.
 * @returns {PlanFit} Масштаб (CSS-пикселей на единицу) и сдвиг плана на холсте.
 */
export function fitPixelPlan(bounds: PlanBounds, field: Frame, resolution: number): PlanFit {
  const fitting = Math.min(field.width / bounds.width, field.height / bounds.height);
  const multiplier = Math.max(1, Math.floor((fitting * resolution) / PIXELS_PER_UNIT));
  const scale = (multiplier * PIXELS_PER_UNIT) / resolution;
  const snap = (value: number) => Math.round(value * resolution) / resolution;
  return {
    scale,
    offset: {
      x: snap(field.x + (field.width - bounds.width * scale) / 2 - bounds.x * scale),
      y: snap(field.y + (field.height - bounds.height * scale) / 2 - bounds.y * scale),
    },
  };
}
