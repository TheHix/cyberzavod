// План цеха в условных единицах. Представление на сайте само решает, сколько пикселей
// в единице, поэтому план один для любой графики.

import type { Aisle } from "./aisle.ts";
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
  /**
   * Наименьшее соотношение ширины поля к высоте, при котором берётся этот план (см.
   * `layoutFor`); у последнего плана в `FACTORY_LAYOUTS` — 0.
   */
  readonly minFieldAspect: number;
  /** Проход — ломаная из точек плана: с места к проходу идут по кратчайшей, дальше вдоль него. */
  readonly aisle: Aisle;
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

// Поле 351×487 на телефоне — соотношение 0,72, и ему нужен портретный план; поле десктопа
// 852×860 — 0,99, там остаётся широкий вид цеха. Граница лежит между ними.
const WIDE_MIN_FIELD_ASPECT = 0.8;

/**
 * Широкий план: петля на полу 16×9. Сверху слева направо — постановка, код, проверки;
 * снизу справа налево — ревью и выпуск, так деталь идёт по кругу. Кабинет мастера — внизу слева,
 * в стороне от маршрутов рабочих; мастер ходит к станкам и встаёт справа от рабочего.
 */
export const WIDE_LAYOUT: FactoryLayout = {
  width: 16,
  height: 9,
  minFieldAspect: WIDE_MIN_FIELD_ASPECT,
  aisle: [
    { x: 0, y: 4.5 },
    { x: 16, y: 4.5 },
  ],
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
 * Портретный план для узкого поля: пол 7×10, станки в два столбца по обе стороны вертикального
 * прохода. Деталь идёт по кругу: левый столбец сверху вниз, затем правый снизу вверх. Кабинет
 * мастера — внизу справа. Все рабочие и мастер у стола смотрят вверх. Путь детали от места
 * рабочего к проходу горизонтальный, поэтому место мастера на клетку ниже места рабочего,
 * со стороны прохода: мастер стоит вне этого пути.
 */
export const PORTRAIT_LAYOUT: FactoryLayout = {
  width: 7,
  height: 10,
  minFieldAspect: 0,
  aisle: [
    { x: 3.5, y: 0 },
    { x: 3.5, y: 10 },
  ],
  stations: {
    spec: {
      machine: { x: 1.5, y: 1.6 },
      post: { x: 1.5, y: 2.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 3.9 },
    },
    code: {
      machine: { x: 1.5, y: 4.6 },
      post: { x: 1.5, y: 5.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 6.9 },
    },
    test: {
      machine: { x: 1.5, y: 7.6 },
      post: { x: 1.5, y: 8.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 9.9 },
    },
    review: {
      machine: { x: 5.5, y: 4.6 },
      post: { x: 5.5, y: 5.9 },
      facing: FACING_UP,
      foremanPost: { x: 4.4, y: 6.9 },
    },
    ship: {
      machine: { x: 5.5, y: 1.6 },
      post: { x: 5.5, y: 2.9 },
      facing: FACING_UP,
      foremanPost: { x: 4.4, y: 3.9 },
    },
  },
  foreman: {
    desk: { x: 5.5, y: 7.8 },
    post: { x: 5.5, y: 8.9 },
    facing: FACING_UP,
    door: { x: 4.4, y: 8.9 },
  },
};

/**
 * Планы цеха от широкого к узкому: `layoutFor` берёт первый подходящий по форме поля.
 * Новый план — новая строка здесь.
 */
export const FACTORY_LAYOUTS: readonly [FactoryLayout, ...FactoryLayout[]] = [
  WIDE_LAYOUT,
  PORTRAIT_LAYOUT,
];

/**
 * Выбирает план по форме поля: первый, у которого `minFieldAspect` не больше отношения
 * ширины поля к высоте. Если не подходит ни один, остаётся самый узкий — последний.
 * @param {number} width Ширина поля, пикселей.
 * @param {number} height Высота поля, пикселей.
 * @param {readonly [FactoryLayout, ...FactoryLayout[]]} layouts Планы от широкого к узкому; у последнего `minFieldAspect` 0.
 * @returns {FactoryLayout} Подходящий план; у поля без площади — последний.
 */
export function layoutFor(
  width: number,
  height: number,
  layouts: readonly [FactoryLayout, ...FactoryLayout[]] = FACTORY_LAYOUTS,
): FactoryLayout {
  const narrowest = layouts[layouts.length - 1] ?? layouts[0];
  if (width <= 0 || height <= 0) return narrowest;
  const aspect = width / height;
  return layouts.find((layout) => layout.minFieldAspect <= aspect) ?? narrowest;
}

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
