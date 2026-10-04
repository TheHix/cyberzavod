// План цеха в условных единицах. Представление на сайте само решает, сколько пикселей
// в единице, поэтому план один для любой графики.

import type { Stage } from "./recording.ts";

/** Точка на плане цеха; ось y направлена вниз, как на экране. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Станок на плане: где стоит он, где у него работает рабочий и куда тот смотрит. */
export interface StationPlan {
  readonly machine: Point;
  readonly post: Point;
  /** Направление взгляда рабочего за станком, радианы: 0 — вправо, π/2 — вниз. */
  readonly facing: number;
}

/** План цеха: размер пола, проход и станок каждого этапа. */
export interface FactoryLayout {
  readonly width: number;
  readonly height: number;
  /** Линия прохода между рядами станков, y: по ней бегают, не задевая чужие места. */
  readonly aisle: number;
  readonly stations: Readonly<Record<Stage, StationPlan>>;
}

const FACING_UP = -Math.PI / 2;
const FACING_DOWN = Math.PI / 2;

/**
 * План по умолчанию: петля на полу 16×9. Сверху слева направо — постановка, код, проверки;
 * снизу справа налево — ревью и выпуск, так деталь идёт по кругу.
 */
export const DEFAULT_LAYOUT: FactoryLayout = {
  width: 16,
  height: 9,
  aisle: 4.5,
  stations: {
    spec: { machine: { x: 3, y: 1.6 }, post: { x: 3, y: 2.9 }, facing: FACING_UP },
    code: { machine: { x: 8, y: 1.6 }, post: { x: 8, y: 2.9 }, facing: FACING_UP },
    test: { machine: { x: 13, y: 1.6 }, post: { x: 13, y: 2.9 }, facing: FACING_UP },
    review: { machine: { x: 13, y: 7.4 }, post: { x: 13, y: 6.1 }, facing: FACING_DOWN },
    ship: { machine: { x: 8, y: 7.4 }, post: { x: 8, y: 6.1 }, facing: FACING_DOWN },
  },
};

/**
 * Расстояние между точками плана.
 * @param {Point} a Первая точка.
 * @param {Point} b Вторая точка.
 * @returns {number} Расстояние в единицах плана.
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Точка на отрезке между двумя точками.
 * @param {Point} from Начало отрезка.
 * @param {Point} to Конец отрезка.
 * @param {number} progress Доля пути от 0 до 1.
 * @returns {Point} Точка, пройденная на эту долю.
 */
export function pointBetween(from: Point, to: Point, progress: number): Point {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

/**
 * Направление взгляда из одной точки на другую.
 * @param {Point} from Откуда смотрят.
 * @param {Point} to Куда смотрят.
 * @returns {number} Угол в радианах: 0 — вправо, π/2 — вниз.
 */
export function headingTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Точка, где останавливается идущий к цели: не доходя до неё заданное расстояние.
 * @param {Point} from Откуда идут.
 * @param {Point} target К кому идут.
 * @param {number} gap Сколько не доходить, в единицах плана.
 * @returns {Point} Точка остановки; если цель ближе `gap`, — место, откуда шли.
 */
export function stopShortOf(from: Point, target: Point, gap: number): Point {
  const length = distance(from, target);
  if (length <= gap) return from;
  return pointBetween(from, target, (length - gap) / length);
}
