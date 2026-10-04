// Пол цеха: плитка до краёв любого экрана, полоса прохода с разметкой и площадки под станками.
// Рисуется один раз и дальше не меняется; координаты — в точках рисования (`UNIT` на единицу).

import { STAGES, type FactoryLayout } from "@cyberzavod/core";
import { Container, Graphics, TilingSprite, type Renderer } from "pixi.js";
import type { Palette } from "./palette.ts";
import { UNIT } from "./units.ts";

// Пол и полоса прохода тянутся далеко за план — на любом экране край не виден.
const FLOOR_REACH = 200 * UNIT;
const TILE = UNIT;
const GROUT = 4;
const LANE_HALF_WIDTH = 0.55 * UNIT;
const MARK = { length: 0.4 * UNIT, gap: 0.4 * UNIT, width: 0.07 * UNIT } as const;
const EDGE_LINE = { width: 0.04 * UNIT, alpha: 0.7 } as const;
/** Половина ширины площадки станка, точки рисования: по ней считаются границы цеха. */
export const PAD_HALF_WIDTH = 1.55 * UNIT;
// Площадка станка охватывает станок и место рабочего с запасом.
const PAD = { margin: 0.85 * UNIT, radius: 0.35 * UNIT } as const;
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

function drawLane(aisle: number, floor: Palette["floor"]): Graphics {
  const y = aisle * UNIT;
  const lane = new Graphics()
    .rect(-FLOOR_REACH, y - LANE_HALF_WIDTH, FLOOR_REACH * 2, LANE_HALF_WIDTH * 2)
    .fill(floor.lane);
  for (const edge of [y - LANE_HALF_WIDTH, y + LANE_HALF_WIDTH]) {
    lane.moveTo(-FLOOR_REACH, edge).lineTo(FLOOR_REACH, edge);
  }
  lane.stroke({ width: EDGE_LINE.width, color: floor.mark, alpha: EDGE_LINE.alpha });
  // Пунктир посередине — только в пределах далёкой видимости, без лишних тысяч штрихов.
  for (let x = -FLOOR_REACH / 4; x < FLOOR_REACH / 4; x += MARK.length + MARK.gap) {
    lane.rect(x, y - MARK.width / 2, MARK.length, MARK.width);
  }
  return lane.fill(floor.mark);
}

function drawPads(layout: FactoryLayout, palette: Palette): Graphics {
  const pads = new Graphics();
  for (const stage of STAGES) {
    const { machine, post } = layout.stations[stage];
    const top = Math.min(machine.y, post.y) * UNIT - PAD.margin;
    const bottom = Math.max(machine.y, post.y) * UNIT + PAD.margin;
    pads.roundRect(
      machine.x * UNIT - PAD_HALF_WIDTH,
      top,
      PAD_HALF_WIDTH * 2,
      bottom - top,
      PAD.radius,
    );
  }
  return pads
    .fill(palette.floor.pad)
    .stroke({ width: PAD_STROKE.width, color: palette.ink, alpha: PAD_STROKE.alpha });
}

/**
 * Рисует пол цеха в точках рисования (`UNIT` на единицу плана).
 * @param {FactoryLayout} layout План цеха.
 * @param {Renderer} renderer Рендерер — запекает плитку в текстуру.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Пол: плитка, проход и площадки станков.
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
