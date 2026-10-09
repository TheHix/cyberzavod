// The factory aisle is a polyline. From a spot people walk to the aisle by the shortest path, then
// along it: that way a walker never passes through other machines, whatever the layout.

import { distance, type Point } from "./layout.ts";

/** Aisle: a polyline of two or more layout points. */
export type Aisle = readonly [Point, Point, ...Point[]];

/** Stop on the aisle: the aisle point nearest to a spot and the path to it along the aisle. */
export interface AisleStop {
  readonly point: Point;
  /** Length of the path along the aisle from its first vertex to `point`, in layout units. */
  readonly along: number;
}

// Length comparison tolerance: projections onto adjacent segments at a corner are computed
// independently, and without a tolerance "equal" would depend on random rounding.
const EPSILON = 1e-9;

interface Segment {
  readonly from: Point;
  readonly to: Point;
  readonly length: number;
  /** Path along the aisle from its first vertex to the start of the segment. */
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

// Share of the segment nearest to the point; beyond the ends it clamps to the end, 0 for
// a degenerate segment.
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
 * The stop on the aisle nearest to a point.
 * @param {Aisle} aisle Aisle.
 * @param {Point} point Where the walk to the aisle starts.
 * @returns {AisleStop} Projection of the point onto the nearest segment; beyond the aisle ends,
 * its end.
 * If segments are equally far, the first one is taken.
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

  // An aisle of two points always yields at least one segment.
  return nearest ?? { point: aisle[0], along: 0 };
}

/**
 * Aisle vertices strictly between two stops: the corners to pass.
 * @param {Aisle} aisle Aisle.
 * @param {AisleStop} from Where the walk starts.
 * @param {AisleStop} to Where the walk goes.
 * @returns {Point[]} Vertices in walking order; empty on a single segment.
 */
export function aisleWalk(aisle: Aisle, from: AisleStop, to: AisleStop): Point[] {
  const low = Math.min(from.along, to.along);
  const high = Math.max(from.along, to.along);
  const vertices = segmentsOf(aisle).map((segment) => ({
    point: segment.to,
    along: segment.offset + segment.length,
  }));
  const passed = vertices.filter(
    (vertex) => vertex.along > low + EPSILON && vertex.along < high - EPSILON,
  );
  const corners = passed.map((vertex) => vertex.point);

  return from.along <= to.along ? corners : corners.toReversed();
}
