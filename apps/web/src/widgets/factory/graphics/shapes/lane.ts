// Геометрия полосы прохода: кромки ломаной с уголками и штрихи разметки. Чистые расчёты без
// Pixi — рисует их floor.ts.

import type { Aisle, Point } from "@cyberzavod/core";

// Меньше этого знаменателя поворот — разворот на месте, и угол кромки не определён.
const MIN_MITER_DENOMINATOR = 1e-6;

function direction(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function normalOf(unit: Point): Point {
  return { x: -unit.y, y: unit.x };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Продолжает крайние отрезки ломаной за её концы по их направлению.
 * @param {Aisle} aisle Проход.
 * @param {number} reach На сколько продолжить каждый конец.
 * @returns {Point[]} Вершины продолженной ломаной.
 */
export function extendedAisle(aisle: Aisle, reach: number): Point[] {
  const points = [...aisle];
  const [first, second] = aisle;
  const last = aisle[aisle.length - 1] ?? first;
  const beforeLast = aisle[aisle.length - 2] ?? second;
  const head = direction(second, first);
  const tail = direction(beforeLast, last);
  points[0] = { x: first.x + head.x * reach, y: first.y + head.y * reach };
  points[points.length - 1] = { x: last.x + tail.x * reach, y: last.y + tail.y * reach };
  return points;
}

/**
 * Кромка полосы вдоль ломаной на заданном расстоянии от оси; в углах кромки сходятся
 * в одной точке, без щелей и перехлёстов.
 * @param {readonly Point[]} points Вершины оси полосы.
 * @param {number} offset Расстояние от оси: со знаком, плюс — вправо от хода при оси y вниз.
 * @returns {Point[]} Вершины кромки, по одной на вершину оси.
 */
export function laneEdge(points: readonly Point[], offset: number): Point[] {
  return points.map((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    const incoming = before && normalOf(direction(before, point));
    const outgoing = after && normalOf(direction(point, after));
    const miter = incoming && outgoing ? miterOf(incoming, outgoing) : (incoming ?? outgoing);
    if (miter === undefined) return point;
    return { x: point.x + miter.x * offset, y: point.y + miter.y * offset };
  });
}

// Смещение угла: сумма нормалей, растянутая так, чтобы кромка осталась на своём расстоянии
// от обоих отрезков.
function miterOf(first: Point, second: Point): Point {
  const denominator = 1 + dot(first, second);
  if (denominator < MIN_MITER_DENOMINATOR) return first;
  return { x: (first.x + second.x) / denominator, y: (first.y + second.y) / denominator };
}

/** Штрих разметки: четыре угла прямоугольника вдоль отрезка. */
export type Dash = readonly [Point, Point, Point, Point];

/**
 * Штрихи разметки вдоль каждого отрезка ломаной, от его начала.
 * @param {readonly Point[]} points Вершины оси полосы.
 * @param {number} length Длина штриха.
 * @param {number} gap Промежуток между штрихами.
 * @param {number} width Толщина штриха.
 * @returns {Dash[]} Штрихи по порядку отрезков.
 */
export function laneDashes(
  points: readonly Point[],
  length: number,
  gap: number,
  width: number,
): Dash[] {
  const dashes: Dash[] = [];
  for (const [index, to] of points.entries()) {
    const from = points[index - 1];
    if (from === undefined) continue;
    const unit = direction(from, to);
    const normal = normalOf(unit);
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    for (let start = 0; start < segmentLength; start += length + gap) {
      const end = Math.min(start + length, segmentLength);
      const a = { x: from.x + unit.x * start, y: from.y + unit.y * start };
      const b = { x: from.x + unit.x * end, y: from.y + unit.y * end };
      const half = width / 2;
      dashes.push([
        { x: a.x - normal.x * half, y: a.y - normal.y * half },
        { x: b.x - normal.x * half, y: b.y - normal.y * half },
        { x: b.x + normal.x * half, y: b.y + normal.y * half },
        { x: a.x + normal.x * half, y: a.y + normal.y * half },
      ]);
    }
  }
  return dashes;
}
