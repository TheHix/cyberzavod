// Aisle geometry: rectangles along the segments of a polyline. Pure calculations without Pixi;
// floor.ts draws them. Pixel art cannot do diagonals: the steps do not tile.

import type { Aisle, Point } from "@cyberzavod/player";
import type { PlanBounds } from "./bounds.ts";

function direction(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  if (length === 0) return { x: 0, y: 0 };

  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * Extends the end segments of a polyline beyond its ends in their direction.
 * @param {Aisle} aisle Aisle.
 * @param {number} reach How far to extend each end.
 * @returns {Point[]} Vertices of the extended polyline.
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
 * Rectangles of the aisle strip: one per segment of the extended polyline. Inner joints overlap
 * by the half width, so no gap remains in a corner.
 * @param {Aisle} aisle Aisle.
 * @param {number} reach How far to extend the end segments beyond the ends.
 * @param {number} halfWidth Half width of the strip.
 * @returns {PlanBounds[]} Rectangles in the same units as the aisle.
 * @throws {Error} If some segment runs diagonally.
 */
export function laneRects(aisle: Aisle, reach: number, halfWidth: number): PlanBounds[] {
  const points = extendedAisle(aisle, reach);
  const lastSegment = points.length - 2;
  const rects: PlanBounds[] = [];

  for (const [index, from] of points.entries()) {
    const to = points[index + 1];

    if (to === undefined) continue;

    const isHorizontal = from.y === to.y;

    if (!isHorizontal && from.x !== to.x) {
      throw new Error(
        `проход идёт по диагонали от (${from.x}, ${from.y}) к (${to.x}, ${to.y}): ` +
          "пиксельная графика рисует только горизонтали и вертикали",
      );
    }

    const before = index === 0 ? 0 : halfWidth;
    const after = index === lastSegment ? 0 : halfWidth;

    rects.push(segmentRect({ from, to, isHorizontal }, halfWidth, { before, after }));
  }

  return rects;
}

interface Segment {
  readonly from: Point;
  readonly to: Point;
  readonly isHorizontal: boolean;
}

// A segment with a margin at the joints: `before` at the start, `after` at the end, along the
// segment.
function segmentRect(
  { from, to, isHorizontal }: Segment,
  halfWidth: number,
  overlap: { readonly before: number; readonly after: number },
): PlanBounds {
  const start = isHorizontal ? from.x : from.y;
  const end = isHorizontal ? to.x : to.y;
  const isReversed = end < start;
  const low = Math.min(start, end) - (isReversed ? overlap.after : overlap.before);
  const high = Math.max(start, end) + (isReversed ? overlap.before : overlap.after);
  const across = (isHorizontal ? from.y : from.x) - halfWidth;

  return isHorizontal
    ? { x: low, y: across, width: high - low, height: 2 * halfWidth }
    : { x: across, y: low, width: 2 * halfWidth, height: high - low };
}
