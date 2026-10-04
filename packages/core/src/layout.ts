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
  /** Где стоит мастер, когда говорит с рабочим: сбоку от рабочего места, вне пути детали. */
  readonly foremanPost: Point;
}

/** Кабинет мастера: стол, место за ним, выход и куда мастер смотрит, пока ни с кем не говорит. */
export interface ForemanPlan {
  readonly desk: Point;
  readonly post: Point;
  /** Направление взгляда мастера у стола, радианы: 0 — вправо, π/2 — вниз. */
  readonly facing: number;
  /** Выход из кабинета в обход стола: отсюда мастер выходит в проход. */
  readonly door: Point;
}

/** План цеха: размер пола, проход, станок каждого этапа и кабинет мастера. */
export interface FactoryLayout {
  readonly width: number;
  readonly height: number;
  /** Линия прохода между рядами станков, y: по ней бегают, не задевая чужие места. */
  readonly aisle: number;
  readonly stations: Readonly<Record<Stage, StationPlan>>;
  readonly foreman: ForemanPlan;
}

const FACING_UP = -Math.PI / 2;
const FACING_DOWN = Math.PI / 2;
// Мастер встаёт рядом с рабочим, на этом расстоянии по горизонтали от его места.
const FOREMAN_SIDE_OFFSET = 1.5;

function stationOf(machine: Point, post: Point, facing: number): StationPlan {
  return { machine, post, facing, foremanPost: { x: post.x + FOREMAN_SIDE_OFFSET, y: post.y } };
}

/**
 * План по умолчанию: петля на полу 16×9. Сверху слева направо — постановка, код, проверки;
 * снизу справа налево — ревью и выпуск, так деталь идёт по кругу. Кабинет мастера — внизу слева,
 * в стороне от маршрутов рабочих; мастер ходит к станкам и встаёт справа от рабочего.
 */
export const DEFAULT_LAYOUT: FactoryLayout = {
  width: 16,
  height: 9,
  aisle: 4.5,
  stations: {
    spec: stationOf({ x: 3, y: 1.6 }, { x: 3, y: 2.9 }, FACING_UP),
    code: stationOf({ x: 8, y: 1.6 }, { x: 8, y: 2.9 }, FACING_UP),
    test: stationOf({ x: 13, y: 1.6 }, { x: 13, y: 2.9 }, FACING_UP),
    review: stationOf({ x: 13, y: 7.4 }, { x: 13, y: 6.1 }, FACING_DOWN),
    ship: stationOf({ x: 8, y: 7.4 }, { x: 8, y: 6.1 }, FACING_DOWN),
  },
  foreman: {
    desk: { x: 3, y: 6.3 },
    post: { x: 3, y: 7.4 },
    facing: FACING_UP,
    door: { x: 4.5, y: 7.4 },
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
