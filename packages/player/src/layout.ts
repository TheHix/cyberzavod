// Factory floor layout in abstract units. The site's view decides how many pixels make a unit,
// so one layout serves any graphics.

import type { Aisle } from "./aisle.ts";
import { type Stage } from "@cyberzavod/core";

/** A point on the factory layout; the y axis points down, as on screen. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A machine on the layout: where it stands, where its worker works and which way they face. */
export interface StationPlan {
  readonly machine: Point;
  readonly post: Point;
  /** Heading of the worker at the machine, radians: 0 is right, π/2 is down. */
  readonly facing: number;
  /** Where the foreman stands when talking to the worker: beside the post, off the part's path. */
  readonly foremanPost: Point;
}

/** The foreman's office: desk, spot behind it, exit and where the foreman faces when idle. */
export interface ForemanPlan {
  readonly desk: Point;
  readonly post: Point;
  /** Heading of the foreman at the desk, radians: 0 is right, π/2 is down. */
  readonly facing: number;
  /** Exit from the office around the desk: from here the foreman steps into the aisle. */
  readonly door: Point;
}

/** Size of a rectangle on screen: the field for the layout or the whole window, in pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Factory layout: floor size, aisle, the machine of each stage and the foreman's office. */
export interface FactoryLayout {
  readonly width: number;
  readonly height: number;
  /**
   * The smallest field width-to-height ratio at which this layout is chosen (see
   * `layoutFor`); 0 for the last layout in `FACTORY_LAYOUTS`.
   */
  readonly minFieldAspect: number;
  /**
   * The smallest screen width-to-height ratio at which this layout is chosen (see
   * `layoutFor`); 0 for the last layout in `FACTORY_LAYOUTS`.
   */
  readonly minScreenAspect: number;
  /** Aisle: a polyline of layout points; people walk to it by the shortest path, then along it. */
  readonly aisle: Aisle;
  readonly stations: Readonly<Record<Stage, StationPlan>>;
  readonly foreman: ForemanPlan;
}

const FACING_UP = -Math.PI / 2;
const FACING_DOWN = Math.PI / 2;
// The foreman stands next to the worker, this far horizontally from the worker's spot.
const FOREMAN_SIDE_OFFSET = 1.5;

function stationOf(machine: Point, post: Point, facing: number): StationPlan {
  return { machine, post, facing, foremanPost: { x: post.x + FOREMAN_SIDE_OFFSET, y: post.y } };
}

// A 351×487 field on a phone has a ratio of 0.72 and needs the portrait layout; a desktop field of
// 852×860 is 0.99 and keeps the wide factory view. The threshold lies between them.
const WIDE_MIN_FIELD_ASPECT = 0.8;
// The field shape alone is not enough: in Safari on iPhone the browser bars eat the height, and the
// field under the menu and HUD comes out almost square, as on desktop. A screen in portrait
// orientation always gets the portrait layout.
const WIDE_MIN_SCREEN_ASPECT = 1;

/**
 * Wide layout: a loop on a 16×9 floor. Along the top, left to right: plan, code, review;
 * along the bottom, right to left: checks and record, so the part goes around. The foreman's
 * office is bottom left, away from the workers' routes; the foreman walks to machines and stands
 * to the right of the worker.
 */
export const WIDE_LAYOUT: FactoryLayout = {
  width: 16,
  height: 9,
  minFieldAspect: WIDE_MIN_FIELD_ASPECT,
  minScreenAspect: WIDE_MIN_SCREEN_ASPECT,
  aisle: [
    { x: 0, y: 4.5 },
    { x: 16, y: 4.5 },
  ],
  stations: {
    planning: stationOf({ x: 3, y: 1.6 }, { x: 3, y: 2.9 }, FACING_UP),
    implementation: stationOf({ x: 8, y: 1.6 }, { x: 8, y: 2.9 }, FACING_UP),
    review: stationOf({ x: 13, y: 1.6 }, { x: 13, y: 2.9 }, FACING_UP),
    verification: stationOf({ x: 13, y: 7.4 }, { x: 13, y: 6.1 }, FACING_DOWN),
    record: stationOf({ x: 8, y: 7.4 }, { x: 8, y: 6.1 }, FACING_DOWN),
  },
  foreman: {
    desk: { x: 3, y: 6.3 },
    post: { x: 3, y: 7.4 },
    facing: FACING_UP,
    door: { x: 4.5, y: 7.4 },
  },
};

/**
 * Portrait layout for a narrow field: a 7×10 floor, machines in two columns on both sides of a
 * vertical aisle. The part goes around: the left column top to bottom, then the right one bottom to
 * top. The foreman's office is bottom right. All workers and the foreman at the desk face up. The
 * part's path from a worker's spot to the aisle is horizontal, so the foreman's spot is one cell
 * below the worker's, on the aisle side: the foreman stands off that path.
 */
export const PORTRAIT_LAYOUT: FactoryLayout = {
  width: 7,
  height: 10,
  minFieldAspect: 0,
  minScreenAspect: 0,
  aisle: [
    { x: 3.5, y: 0 },
    { x: 3.5, y: 10 },
  ],
  stations: {
    planning: {
      machine: { x: 1.5, y: 1.6 },
      post: { x: 1.5, y: 2.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 3.9 },
    },
    implementation: {
      machine: { x: 1.5, y: 4.6 },
      post: { x: 1.5, y: 5.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 6.9 },
    },
    review: {
      machine: { x: 1.5, y: 7.6 },
      post: { x: 1.5, y: 8.9 },
      facing: FACING_UP,
      foremanPost: { x: 2.6, y: 9.9 },
    },
    verification: {
      machine: { x: 5.5, y: 4.6 },
      post: { x: 5.5, y: 5.9 },
      facing: FACING_UP,
      foremanPost: { x: 4.4, y: 6.9 },
    },
    record: {
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
 * Factory layouts from wide to narrow: `layoutFor` takes the first that fits the field shape.
 * A new layout is a new line here.
 */
export const FACTORY_LAYOUTS: readonly [FactoryLayout, ...FactoryLayout[]] = [
  WIDE_LAYOUT,
  PORTRAIT_LAYOUT,
];

function aspectOf(size: Size): number {
  return size.width / size.height;
}

function hasArea(size: Size): boolean {
  return size.width > 0 && size.height > 0;
}

/**
 * Picks a layout by the shape of the field and the screen: the first whose `minFieldAspect` is at
 * most the field's width-to-height ratio, and whose `minScreenAspect` is at most the screen's. If
 * none fits, the narrowest one, the last, remains.
 * @param {Size} field Field the layout is fitted into.
 * @param {Size} screen The whole window.
 * @param {readonly [FactoryLayout, ...FactoryLayout[]]} layouts Layouts from wide to narrow; the
 * last has both thresholds at 0.
 * @returns {FactoryLayout} The fitting layout; the last one if the field or screen has no area.
 */
export function layoutFor(
  field: Size,
  screen: Size,
  layouts: readonly [FactoryLayout, ...FactoryLayout[]] = FACTORY_LAYOUTS,
): FactoryLayout {
  const narrowest = layouts[layouts.length - 1] ?? layouts[0];

  if (!hasArea(field) || !hasArea(screen)) return narrowest;

  const fieldAspect = aspectOf(field);
  const screenAspect = aspectOf(screen);

  const fits = (layout: FactoryLayout) =>
    layout.minFieldAspect <= fieldAspect && layout.minScreenAspect <= screenAspect;

  return layouts.find(fits) ?? narrowest;
}

/**
 * Distance between layout points.
 * @param {Point} a First point.
 * @param {Point} b Second point.
 * @returns {number} Distance in layout units.
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * A point on the segment between two points.
 * @param {Point} from Start of the segment.
 * @param {Point} to End of the segment.
 * @param {number} progress Share of the way from 0 to 1.
 * @returns {Point} The point reached at that share.
 */
export function pointBetween(from: Point, to: Point, progress: number): Point {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

/**
 * Heading from one point toward another.
 * @param {Point} from Where one looks from.
 * @param {Point} to Where one looks.
 * @returns {number} Angle in radians: 0 is right, π/2 is down.
 */
export function headingTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Point where someone walking toward a target stops: the given distance short of it.
 * @param {Point} from Where the walk starts.
 * @param {Point} target Who the walk is toward.
 * @param {number} gap How far short to stop, in layout units.
 * @returns {Point} The stopping point; if the target is closer than `gap`, the starting spot.
 */
export function stopShortOf(from: Point, target: Point, gap: number): Point {
  const length = distance(from, target);

  if (length <= gap) return from;

  return pointBetween(from, target, (length - gap) / length);
}
