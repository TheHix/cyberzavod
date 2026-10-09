// Plaques with machine and office names: where they stand and how they are drawn. Both drawing
// and factory bounds (`planBounds`) compute the position, so a plaque cannot end up outside the
// frame.

import { STAGES, type Stage } from "@cyberzavod/core";
import {
  type FactoryLayout,
  type ForemanPlan,
  type Point,
  type StationPlan,
} from "@cyberzavod/player";
import { Container, Sprite } from "pixi.js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { ACTOR_FIGURE } from "./actors.ts";
import { plaqueImage, plaqueSize } from "./glyphs.ts";
import type { PlanBounds } from "./bounds.ts";
import { MACHINE_SIZE } from "./machines.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** Where a plaque stands and how much space it takes, in plan units. */
export interface PlaquePlacement {
  readonly text: string;
  readonly center: Point;
  readonly size: { width: number; height: number };
}

// Gap between a plaque and a machine, sprite pixels.
const PLAQUE_GAP = 1;

function placementOf(text: string, center: Point): PlaquePlacement {
  const { width, height } = plaqueSize(text);

  return {
    text,
    center,
    size: { width: width / PIXELS_PER_UNIT, height: height / PIXELS_PER_UNIT },
  };
}

// Distance from the center of a machine (or the foreman spot) to the center of the plaque: half
// the machine, the gap and half the plaque.
function offsetOf(text: string): number {
  const plaqueHeight = plaqueSize(text).height;

  return (MACHINE_SIZE.height + plaqueHeight) / 2 / PIXELS_PER_UNIT + PLAQUE_GAP / PIXELS_PER_UNIT;
}

// A machine plaque is on the side opposite the worker; if they are at the same height, above the
// machine.
function stationPlacement(stage: Stage, plan: StationPlan, locale: Locale): PlaquePlacement {
  const text = STAGE_LABELS[stage][locale];
  const awayFromWorker = Math.sign(plan.machine.y - plan.post.y) || -1;

  return placementOf(text, {
    x: plan.machine.x,
    y: plan.machine.y + awayFromWorker * offsetOf(text),
  });
}

// The office plaque is behind the foreman spot, on the same side of the desk as the foreman, in
// one row with the machine plaques.
function foremanPlacement(plan: ForemanPlan, locale: Locale): PlaquePlacement {
  const awayFromDesk = Math.sign(plan.post.y - plan.desk.y) || 1;
  const text = FOREMAN_LABEL[locale];

  return placementOf(text, {
    x: plan.desk.x,
    y: plan.post.y + awayFromDesk * offsetOf(text),
  });
}

// People stand at workstations, at foreman spots near the machines, at the desk and at the office
// door.
function figurePoints(layout: FactoryLayout): Point[] {
  const stations = STAGES.map((stage) => layout.stations[stage]);

  return [
    ...stations.map(({ post }) => post),
    ...stations.map(({ foremanPost }) => foremanPost),
    layout.foreman.post,
    layout.foreman.door,
  ];
}

// Rectangle of a standing human in plan units.
function figureRect(point: Point): PlanBounds {
  const { left, top, right, bottom } = ACTOR_FIGURE;

  return {
    x: point.x + left / PIXELS_PER_UNIT,
    y: point.y + top / PIXELS_PER_UNIT,
    width: (right - left) / PIXELS_PER_UNIT,
    height: (bottom - top) / PIXELS_PER_UNIT,
  };
}

function rectOf({ center, size }: PlaquePlacement): PlanBounds {
  return { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size };
}

function overlaps(a: PlanBounds, b: PlanBounds): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// If a figure stands on a plaque, the plaque moves along the row by the smaller of two distances,
// left or right, until there is a gap between them. The vertical is left alone: it is set by the
// worker's side and the machine size.
function clearOf(placement: PlaquePlacement, figures: readonly PlanBounds[]): PlaquePlacement {
  const gap = PLAQUE_GAP / PIXELS_PER_UNIT;
  let center = placement.center;

  for (let pass = 0; pass <= figures.length; pass++) {
    const moved = { ...placement, center };
    const rect = rectOf(moved);
    const blocking = figures.find((figure) => overlaps(rect, figure));

    if (blocking === undefined) return moved;

    const left = blocking.x - gap - (rect.x + rect.width);
    const right = blocking.x + blocking.width + gap - rect.x;

    const shift = -left <= right ? left : right;

    center = { x: center.x + shift, y: center.y };
  }

  throw new Error(`табличка «${placement.text}» не помещается между фигурами`);
}

/**
 * Positions of all plan plaques: one per machine and one for the foreman's office. A plaque does
 * not overlap a human at any of their plan points.
 * @param {FactoryLayout} layout Floor plan.
 * @param {Locale} locale Label language.
 * @returns {PlaquePlacement[]} Plaques in stage order, the office last.
 * @throws {Error} If a plaque cannot be placed without touching figures.
 */
export function plaquePlacements(layout: FactoryLayout, locale: Locale): PlaquePlacement[] {
  const figures = figurePoints(layout).map(figureRect);

  return [
    ...STAGES.map((stage) => stationPlacement(stage, layout.stations[stage], locale)),
    foremanPlacement(layout.foreman, locale),
  ].map((placement) => clearOf(placement, figures));
}

/**
 * Plaque rectangle in sprite pixels: the top left corner is a whole pixel, as it is drawn.
 * @param {PlaquePlacement} placement Plaque position.
 * @returns {PlanBounds} Rectangle in sprite pixels.
 */
export function plaqueRect({ center, size }: PlaquePlacement): PlanBounds {
  return {
    x: Math.round((center.x - size.width / 2) * PIXELS_PER_UNIT),
    y: Math.round((center.y - size.height / 2) * PIXELS_PER_UNIT),
    width: Math.round(size.width * PIXELS_PER_UNIT),
    height: Math.round(size.height * PIXELS_PER_UNIT),
  };
}

/**
 * Draws the plan plaques; coordinates are in sprite pixels.
 * @param {FactoryLayout} layout Floor plan.
 * @param {Palette} palette Factory inks.
 * @param {Locale} locale Label language.
 * @returns {Container} All plaques: they lie over the machines and the office.
 */
export function drawPlaques(layout: FactoryLayout, palette: Palette, locale: Locale): Container {
  const plaques = new Container();

  for (const placement of plaquePlacements(layout, locale)) {
    const plaque = new Sprite(textureOf(plaqueImage(placement.text, palette)));
    const { x, y } = plaqueRect(placement);

    plaque.position.set(x, y);
    plaques.addChild(plaque);
  }

  return plaques;
}
