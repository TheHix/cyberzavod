// Таблички с названиями станков и кабинета: где они стоят и как рисуются. Место считают
// и рисование, и границы цеха (`planBounds`), поэтому табличка не может оказаться вне кадра.

import {
  STAGES,
  type FactoryLayout,
  type ForemanPlan,
  type Point,
  type Stage,
  type StationPlan,
} from "@cyberzavod/core";
import { Container, Sprite } from "pixi.js";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { ACTOR_FIGURE } from "./actors.ts";
import { plaqueImage, plaqueSize } from "./glyphs.ts";
import type { PlanBounds } from "./bounds.ts";
import { MACHINE_SIZE } from "./machines.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** Где стоит табличка и сколько она занимает, в единицах плана. */
export interface PlaquePlacement {
  readonly text: string;
  readonly center: Point;
  readonly size: { width: number; height: number };
}

// Просвет между табличкой и станком, пиксели рисунка.
const PLAQUE_GAP = 1;

function placementOf(text: string, center: Point): PlaquePlacement {
  const { width, height } = plaqueSize(text);
  return {
    text,
    center,
    size: { width: width / PIXELS_PER_UNIT, height: height / PIXELS_PER_UNIT },
  };
}

// Расстояние от центра станка (или места мастера) до центра таблички: половина станка, зазор
// и половина таблички.
function offsetOf(text: string): number {
  const plaqueHeight = plaqueSize(text).height;
  return (MACHINE_SIZE.height + plaqueHeight) / 2 / PIXELS_PER_UNIT + PLAQUE_GAP / PIXELS_PER_UNIT;
}

// Табличка станка — со стороны, противоположной рабочему; если они на одной высоте — над станком.
function stationPlacement(stage: Stage, plan: StationPlan): PlaquePlacement {
  const text = STAGE_LABELS[stage];
  const awayFromWorker = Math.sign(plan.machine.y - plan.post.y) || -1;
  return placementOf(text, {
    x: plan.machine.x,
    y: plan.machine.y + awayFromWorker * offsetOf(text),
  });
}

// Табличка кабинета — за местом мастера, по ту же сторону от стола, что и он, в одном ряду
// с табличками станков.
function foremanPlacement(plan: ForemanPlan): PlaquePlacement {
  const awayFromDesk = Math.sign(plan.post.y - plan.desk.y) || 1;
  return placementOf(FOREMAN_LABEL, {
    x: plan.desk.x,
    y: plan.post.y + awayFromDesk * offsetOf(FOREMAN_LABEL),
  });
}

// Люди стоят у рабочих мест, у мест мастера возле станков, за столом и у двери кабинета.
function figurePoints(layout: FactoryLayout): Point[] {
  const stations = STAGES.map((stage) => layout.stations[stage]);
  return [
    ...stations.map(({ post }) => post),
    ...stations.map(({ foremanPost }) => foremanPost),
    layout.foreman.post,
    layout.foreman.door,
  ];
}

// Прямоугольник стоящего человека в единицах плана.
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

// Если фигура стоит на табличке, табличка сдвигается вдоль ряда на меньшее из двух расстояний —
// влево или вправо, — пока между ними не окажется зазор. Вертикаль не трогаем: она задана
// стороной рабочего и размерами станка.
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
    center = { x: center.x + (-left <= right ? left : right), y: center.y };
  }
  throw new Error(`табличка «${placement.text}» не помещается между фигурами`);
}

/**
 * Места всех табличек плана: по одной на станок и на кабинет мастера. Табличка не заходит
 * на человека ни в одной его точке плана.
 * @param {FactoryLayout} layout План цеха.
 * @returns {PlaquePlacement[]} Таблички в порядке этапов, кабинет — последний.
 * @throws {Error} Если табличку нельзя поставить, не задев фигур.
 */
export function plaquePlacements(layout: FactoryLayout): PlaquePlacement[] {
  const figures = figurePoints(layout).map(figureRect);
  return [
    ...STAGES.map((stage) => stationPlacement(stage, layout.stations[stage])),
    foremanPlacement(layout.foreman),
  ].map((placement) => clearOf(placement, figures));
}

/**
 * Прямоугольник таблички в пикселях рисунка: левый верхний угол — целый пиксель, как её рисуют.
 * @param {PlaquePlacement} placement Место таблички.
 * @returns {PlanBounds} Прямоугольник в пикселях рисунка.
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
 * Рисует таблички плана; координаты — в пикселях рисунка.
 * @param {FactoryLayout} layout План цеха.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Все таблички: они лежат поверх станков и кабинета.
 */
export function drawPlaques(layout: FactoryLayout, palette: Palette): Container {
  const plaques = new Container();
  for (const placement of plaquePlacements(layout)) {
    const plaque = new Sprite(textureOf(plaqueImage(placement.text, palette)));
    const { x, y } = plaqueRect(placement);
    plaque.position.set(x, y);
    plaques.addChild(plaque);
  }
  return plaques;
}
