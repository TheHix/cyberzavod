// Пол цеха: плитка до краёв любого экрана, полоса прохода с разметкой, площадки под станками
// и под кабинетом мастера.
// Рисуется один раз и дальше не меняется; координаты — в точках рисования (`UNIT` на единицу).

import { STAGES, type Aisle, type FactoryLayout, type Point } from "@cyberzavod/core";
import { Container, Graphics, TilingSprite, type Renderer } from "pixi.js";
import { extendedAisle, laneDashes, laneEdge } from "./lane.ts";
import type { Palette } from "./palette.ts";
import { UNIT } from "./units.ts";

// Пол и полоса прохода тянутся далеко за план — на любом экране край не виден.
const FLOOR_REACH = 200 * UNIT;
// Штрихов разметки на проходе хватает в пределах далёкой видимости.
const DASH_REACH = FLOOR_REACH / 4;
const TILE = UNIT;
const GROUT = 4;
const LANE_HALF_WIDTH = 0.55 * UNIT;
const MARK = { length: 0.4 * UNIT, gap: 0.4 * UNIT, width: 0.07 * UNIT } as const;
const EDGE_LINE = { width: 0.04 * UNIT, alpha: 0.7 } as const;
/** Половина ширины площадки станка, точки рисования: по ней считаются границы цеха. */
export const PAD_HALF_WIDTH = 1.55 * UNIT;
// Площадка станка охватывает станок и место рабочего с запасом.
const PAD = { margin: 0.85 * UNIT, radius: 0.35 * UNIT } as const;
/** Насколько площадка выступает за мебель и место рабочего по вертикали, точки рисования. */
export const PAD_MARGIN = PAD.margin;
const PAD_STROKE = { width: 6, alpha: 0.2 } as const;

function bakeTile(renderer: Renderer, floor: Palette["floor"]) {
  const tile = new Graphics()
    .rect(0, 0, TILE * 2, TILE * 2)
    .fill(floor.grout)
    .rect(GROUT / 2, GROUT / 2, TILE - GROUT, TILE - GROUT)
    .fill(floor.tile)
    .rect(TILE + GROUT / 2, TILE + GROUT / 2, TILE - GROUT, TILE - GROUT)
    .fill(floor.tile)
    .rect(TILE + GROUT / 2, GROUT / 2, TILE - GROUT, TILE - GROUT)
    .fill(floor.tileAlt)
    .rect(GROUT / 2, TILE + GROUT / 2, TILE - GROUT, TILE - GROUT)
    .fill(floor.tileAlt);
  const texture = renderer.generateTexture({ target: tile, resolution: 1 });
  tile.destroy();
  return texture;
}

function flat(points: readonly Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function inDrawingPoints(aisle: Aisle): Aisle {
  const [first, second, ...rest] = aisle;
  const scaled = (point: Point): Point => ({ x: point.x * UNIT, y: point.y * UNIT });
  return [scaled(first), scaled(second), ...rest.map(scaled)];
}

// Полоса идёт вдоль каждого отрезка ломаной; крайние отрезки уходят за экран.
function drawLane(aisle: Aisle, floor: Palette["floor"]): Graphics {
  const axis = extendedAisle(inDrawingPoints(aisle), FLOOR_REACH);
  const left = laneEdge(axis, -LANE_HALF_WIDTH);
  const right = laneEdge(axis, LANE_HALF_WIDTH);
  const lane = new Graphics().poly(flat([...left, ...right.toReversed()])).fill(floor.lane);
  for (const edge of [left, right]) {
    lane.poly(flat(edge), false);
  }
  lane.stroke({ width: EDGE_LINE.width, color: floor.mark, alpha: EDGE_LINE.alpha });
  const dashAxis = extendedAisle(inDrawingPoints(aisle), DASH_REACH);
  for (const dash of laneDashes(dashAxis, MARK.length, MARK.gap, MARK.width)) {
    lane.poly(flat(dash));
  }
  return lane.fill(floor.mark);
}

// Площадка охватывает мебель и место рабочего у неё с запасом.
function addPad(pads: Graphics, furniture: Point, post: Point): void {
  const top = Math.min(furniture.y, post.y) * UNIT - PAD.margin;
  const bottom = Math.max(furniture.y, post.y) * UNIT + PAD.margin;
  pads.roundRect(
    furniture.x * UNIT - PAD_HALF_WIDTH,
    top,
    PAD_HALF_WIDTH * 2,
    bottom - top,
    PAD.radius,
  );
}

function drawPads(layout: FactoryLayout, palette: Palette): Graphics {
  const pads = new Graphics();
  for (const stage of STAGES) {
    const { machine, post } = layout.stations[stage];
    addPad(pads, machine, post);
  }
  addPad(pads, layout.foreman.desk, layout.foreman.post);
  return pads
    .fill(palette.floor.pad)
    .stroke({ width: PAD_STROKE.width, color: palette.ink, alpha: PAD_STROKE.alpha });
}

/**
 * Рисует пол цеха в точках рисования (`UNIT` на единицу плана).
 * @param {FactoryLayout} layout План цеха.
 * @param {Renderer} renderer Рендерер — запекает плитку в текстуру.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Пол: плитка, проход и площадки станков и кабинета.
 */
export function drawFloor(layout: FactoryLayout, renderer: Renderer, palette: Palette): Container {
  const tiles = new TilingSprite({
    texture: bakeTile(renderer, palette.floor),
    width: FLOOR_REACH * 2,
    height: FLOOR_REACH * 2,
  });
  tiles.position.set(-FLOOR_REACH, -FLOOR_REACH);
  // Плитка привязана к началу плана, а не к краю спрайта: швы совпадают с единицами плана.
  tiles.tilePosition.set(FLOOR_REACH % (TILE * 2), FLOOR_REACH % (TILE * 2));
  return new Container({
    children: [tiles, drawLane(layout.aisle, palette.floor), drawPads(layout, palette)],
  });
}
