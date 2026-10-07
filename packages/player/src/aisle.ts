// Проход цеха — ломаная. С места к проходу идут по кратчайшей, дальше вдоль него: так идущий
// не проходит сквозь чужие станки, каким бы ни был план.

import { distance, type Point } from "./layout.ts";

/** Проход: ломаная из двух и больше точек плана. */
export type Aisle = readonly [Point, Point, ...Point[]];

/** Остановка на проходе: ближайшая к месту точка прохода и путь до неё по проходу. */
export interface AisleStop {
  readonly point: Point;
  /** Длина пути по проходу от его первой вершины до `point`, единиц плана. */
  readonly along: number;
}

// Допуск сравнения длин: проекции на соседние отрезки у угла считаются независимо, и
// «поровну» без допуска выпадало бы по случайности округления.
const EPSILON = 1e-9;

interface Segment {
  readonly from: Point;
  readonly to: Point;
  readonly length: number;
  /** Путь по проходу от его первой вершины до начала отрезка. */
  readonly offset: number;
}

function segmentsOf(aisle: Aisle): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  for (const [index, to] of aisle.entries()) {
    const from = aisle[index - 1];
    if (from === undefined) continue;
    const length = distance(from, to);
    segments.push({ from, to, length, offset });
    offset += length;
  }
  return segments;
}

// Доля отрезка, ближайшая к точке; за концами прижимается к концу, у вырожденного отрезка — 0.
function shareNearest(segment: Segment, point: Point): number {
  if (segment.length === 0) return 0;
  const { from, to } = segment;
  const dot = (point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y);
  return Math.min(1, Math.max(0, dot / (segment.length * segment.length)));
}

function stopOn(segment: Segment, point: Point): AisleStop {
  const share = shareNearest(segment, point);
  const { from, to } = segment;
  return {
    point: { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share },
    along: segment.offset + segment.length * share,
  };
}

/**
 * Ближайшая к точке остановка на проходе.
 * @param {Aisle} aisle Проход.
 * @param {Point} point Откуда идут к проходу.
 * @returns {AisleStop} Проекция точки на ближайший отрезок; за концами прохода — его конец.
 * Если отрезки на равном расстоянии, берётся первый.
 */
export function aisleStop(aisle: Aisle, point: Point): AisleStop {
  let nearest: AisleStop | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const segment of segmentsOf(aisle)) {
    const stop = stopOn(segment, point);
    const gap = distance(stop.point, point);
    if (gap < nearestDistance - EPSILON) {
      nearest = stop;
      nearestDistance = gap;
    }
  }
  // Проход из двух точек всегда даёт хотя бы один отрезок.
  return nearest ?? { point: aisle[0], along: 0 };
}

/**
 * Вершины прохода строго между двумя остановками — повороты, которые нужно пройти.
 * @param {Aisle} aisle Проход.
 * @param {AisleStop} from Откуда идут.
 * @param {AisleStop} to Куда идут.
 * @returns {Point[]} Вершины в порядке хода; на одном отрезке — пусто.
 */
export function aisleWalk(aisle: Aisle, from: AisleStop, to: AisleStop): Point[] {
  const low = Math.min(from.along, to.along);
  const high = Math.max(from.along, to.along);
  const corners = segmentsOf(aisle)
    .map((segment) => ({ point: segment.to, along: segment.offset + segment.length }))
    .filter((corner) => corner.along > low + EPSILON && corner.along < high - EPSILON)
    .map((corner) => corner.point);
  return from.along <= to.along ? corners : corners.toReversed();
}
