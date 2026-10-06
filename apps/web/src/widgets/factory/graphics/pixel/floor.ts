// Пол цеха: плитка до краёв любого экрана, полоса прохода с разметкой, площадки под станками
// и под кабинетом мастера. Всё считается в пикселях рисунка и рисуется один раз. Картинки плиток
// собираются кодом, а не строками: они повторяются, и их размер зависит от краски и плана.

import { STAGES, type Aisle, type FactoryLayout, type Point } from "@cyberzavod/core";
import { Container, Sprite, TilingSprite, type Texture } from "pixi.js";
import { blankImage, clearPixel, fillRect, type PixelImage } from "./art.ts";
import type { PlanBounds } from "./bounds.ts";
import { laneRects } from "./lane.ts";
import { shade, type Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

type LaneDirection = "horizontal" | "vertical";

// Пол и полоса прохода тянутся далеко за план — на любом экране край не виден. Кратно двум
// плиткам, чтобы швы ложились на границы единиц плана.
const FLOOR_REACH = 200 * PIXELS_PER_UNIT;
const FLOOR_TILE = PIXELS_PER_UNIT;
const SEAM = 1;
/** Полуширина полосы прохода, пиксели рисунка. */
export const LANE_HALF_WIDTH = 9;
// Штрих разметки: длина, период и толщина по оси прохода.
const DASH = { length: 8, period: 16, thickness: 2 } as const;
const LANE_EDGE = 1;
/** Половина ширины площадки станка, пиксели рисунка. */
export const PAD_HALF_WIDTH = 25;
/** Насколько площадка выступает за мебель и место рабочего по вертикали, пиксели рисунка. */
export const PAD_MARGIN = 14;
const PAD_FRAME = 1;
const PAD_FRAME_SHADE = -0.3;

/**
 * Плитка пола: шахматка из четырёх плиток по 16 пикселей со швом в 1 пиксель.
 * @param {Palette["floor"]} floor Краски пола.
 * @returns {PixelImage} Картинка 32×32, которая повторяется по полу.
 */
export function floorTileImage(floor: Palette["floor"]): PixelImage {
  const image = blankImage(FLOOR_TILE * 2, FLOOR_TILE * 2);
  fillRect(image, 0, 0, image.width, image.height, floor.grout);
  for (const [column, row] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const color = (column + row) % 2 === 0 ? floor.tile : floor.tileAlt;
    fillRect(
      image,
      column * FLOOR_TILE + SEAM,
      row * FLOOR_TILE + SEAM,
      FLOOR_TILE - SEAM,
      FLOOR_TILE - SEAM,
      color,
    );
  }
  return image;
}

/**
 * Плитка полосы прохода: кромки по краям и штрих разметки по оси.
 * @param {LaneDirection} direction Вдоль какой оси идёт полоса.
 * @param {Palette["floor"]} floor Краски пола.
 * @returns {PixelImage} Картинка, которая повторяется вдоль полосы.
 */
export function laneTileImage(direction: LaneDirection, floor: Palette["floor"]): PixelImage {
  const across = LANE_HALF_WIDTH * 2;
  const along = DASH.period;
  const horizontal = direction === "horizontal";
  const image = blankImage(horizontal ? along : across, horizontal ? across : along);
  const rect = (x: number, y: number, alongSize: number, acrossSize: number, color: number) => {
    if (horizontal) fillRect(image, x, y, alongSize, acrossSize, color);
    else fillRect(image, y, x, acrossSize, alongSize, color);
  };
  rect(0, 0, along, across, floor.lane);
  rect(0, 0, along, LANE_EDGE, floor.grout);
  rect(0, across - LANE_EDGE, along, LANE_EDGE, floor.grout);
  rect(0, (across - DASH.thickness) / 2, DASH.length, DASH.thickness, floor.mark);
  return image;
}

/**
 * Площадка под станком или столом: заливка, рамка в 1 пиксель и срезанные углы.
 * @param {number} width Ширина, пиксели рисунка.
 * @param {number} height Высота, пиксели рисунка.
 * @param {Palette} palette Краски цеха.
 * @returns {PixelImage} Картинка площадки.
 */
export function padImage(width: number, height: number, palette: Palette): PixelImage {
  const image = blankImage(width, height);
  fillRect(image, 0, 0, width, height, shade(palette.floor.pad, PAD_FRAME_SHADE));
  fillRect(
    image,
    PAD_FRAME,
    PAD_FRAME,
    width - 2 * PAD_FRAME,
    height - 2 * PAD_FRAME,
    palette.floor.pad,
  );
  for (const [x, y] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ] as const) {
    clearPixel(image, x, y);
  }
  return image;
}

/**
 * Площадки плана: по одной под станок вместе с местом рабочего и под стол кабинета вместе
 * с местом мастера.
 * @param {FactoryLayout} layout План цеха.
 * @returns {PlanBounds[]} Прямоугольники в пикселях рисунка.
 */
export function padRects(layout: FactoryLayout): PlanBounds[] {
  const pairs = [
    ...STAGES.map((stage) => layout.stations[stage]).map(({ machine, post }) => [machine, post]),
    [layout.foreman.desk, layout.foreman.post],
  ] as const;
  return pairs.map(([furniture, post]) => {
    const top = Math.round(Math.min(furniture.y, post.y) * PIXELS_PER_UNIT) - PAD_MARGIN;
    const bottom = Math.round(Math.max(furniture.y, post.y) * PIXELS_PER_UNIT) + PAD_MARGIN;
    return {
      x: Math.round(furniture.x * PIXELS_PER_UNIT) - PAD_HALF_WIDTH,
      y: top,
      width: 2 * PAD_HALF_WIDTH,
      height: bottom - top,
    };
  });
}

function inPixels(aisle: Aisle): Aisle {
  const [first, second, ...rest] = aisle;
  const scaled = (point: Point): Point => ({
    x: Math.round(point.x * PIXELS_PER_UNIT),
    y: Math.round(point.y * PIXELS_PER_UNIT),
  });
  return [scaled(first), scaled(second), ...rest.map(scaled)];
}

function tilingOf(texture: Texture, { x, y, width, height }: PlanBounds): TilingSprite {
  const tiles = new TilingSprite({ texture, width, height });
  tiles.position.set(x, y);
  return tiles;
}

function drawLane(aisle: Aisle, floor: Palette["floor"]): Container {
  const textures = new Map<LaneDirection, Texture>();
  const lane = new Container();
  for (const rect of laneRects(inPixels(aisle), FLOOR_REACH, LANE_HALF_WIDTH)) {
    const direction = rect.width >= rect.height ? "horizontal" : "vertical";
    const texture = textures.get(direction) ?? textureOf(laneTileImage(direction, floor));
    textures.set(direction, texture);
    lane.addChild(tilingOf(texture, rect));
  }
  return lane;
}

function drawPads(layout: FactoryLayout, palette: Palette): Container {
  const pads = new Container();
  for (const { x, y, width, height } of padRects(layout)) {
    const pad = new Sprite(textureOf(padImage(width, height, palette)));
    pad.position.set(x, y);
    pads.addChild(pad);
  }
  return pads;
}

/**
 * Рисует пол цеха в пикселях рисунка (`PIXELS_PER_UNIT` на единицу плана).
 * @param {FactoryLayout} layout План цеха.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Пол: плитка, проход и площадки станков и кабинета.
 * @throws {Error} Если проход плана идёт по диагонали.
 */
export function drawFloor(layout: FactoryLayout, palette: Palette): Container {
  const tiles = tilingOf(textureOf(floorTileImage(palette.floor)), {
    x: -FLOOR_REACH,
    y: -FLOOR_REACH,
    width: FLOOR_REACH * 2,
    height: FLOOR_REACH * 2,
  });
  return new Container({
    children: [tiles, drawLane(layout.aisle, palette.floor), drawPads(layout, palette)],
  });
}
