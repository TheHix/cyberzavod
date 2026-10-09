// Bounds of the drawn factory in plan units: machine and office pads, worker and foreman spots,
// the door and plaques. The plan fits into the field by them, without the empty margins the whole
// plan has. Sizes are taken from the sprites, not tuned.

import { STAGES } from "@cyberzavod/core";
import { type FactoryLayout, type Point } from "@cyberzavod/player";
import type { Locale } from "@/shared/i18n/locale.ts";
import type { Frame, ScreenPoint } from "../factory-graphics.ts";
import { ACTOR_ART } from "./actor-art.ts";
import { artSize } from "./art.ts";
import { padRects } from "./floor.ts";
import { plaquePlacements, plaqueRect } from "./plaques.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** A rectangle. */
export interface PlanBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * How the plan sits in the field: CSS pixels per plan unit and where the plan origin is on the
 * canvas.
 */
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

// A figure centered on a plan point: it stands outside the pad, so it is counted separately.
function actorRect(point: Point): PlanBounds {
  return {
    x: Math.round(point.x * PIXELS_PER_UNIT) - ACTOR_SIZE.width / 2,
    y: Math.round(point.y * PIXELS_PER_UNIT) - ACTOR_SIZE.height / 2,
    ...ACTOR_SIZE,
  };
}

/**
 * Computes which part of the plan the drawn factory occupies.
 * @param {FactoryLayout} layout Floor plan.
 * @param {Locale} locale Label language: plaque width depends on it.
 * @returns {PlanBounds} Rectangle in plan units to fit into the field.
 */
export function planBounds(layout: FactoryLayout, locale: Locale): PlanBounds {
  const rects = [
    ...padRects(layout),
    ...plaquePlacements(layout, locale).map(plaqueRect),
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
 * Fits the drawn factory into the field entirely and centered, so that a sprite pixel takes a whole
 * number of device pixels: a sprite edge does not fall between them and stays sharp.
 * @param {PlanBounds} bounds Bounds of the drawn factory in plan units.
 * @param {Frame} field Canvas field free of the menu and HUD, CSS pixels.
 * @param {number} resolution Device pixels per CSS pixel.
 * @returns {PlanFit} Scale (CSS pixels per unit) and plan offset on the canvas.
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
