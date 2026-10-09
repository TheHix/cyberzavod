// The factory floor: tiles to the edges of any screen, the aisle strip with markings, pads under
// the machines and under the foreman's office. Everything is computed in sprite pixels and drawn
// once. Tile images are built by code, not strings: they repeat, and their size depends on the ink
// and the plan.

import { STAGES } from "@cyberzavod/core";
import { type Aisle, type FactoryLayout, type Point } from "@cyberzavod/player";
import { Container, Sprite, TilingSprite, type Texture } from "pixi.js";
import { blankImage, clearPixel, fillRect, type PixelImage } from "./art.ts";
import type { PlanBounds } from "./bounds.ts";
import { laneRects } from "./lane.ts";
import { shade } from "@/shared/lib/color.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

type LaneDirection = "horizontal" | "vertical";

// The floor and the aisle strip extend far beyond the plan, so the edge is not visible on any
// screen. A multiple of two tiles, so seams fall on plan unit boundaries.
const FLOOR_REACH = 200 * PIXELS_PER_UNIT;
const FLOOR_TILE = PIXELS_PER_UNIT;
const SEAM = 1;

/** Half width of the aisle strip, sprite pixels. */
export const LANE_HALF_WIDTH = 9;
// Marking dash: length, period and thickness along the aisle axis.
const DASH = { length: 8, period: 16, thickness: 2 } as const;
const LANE_EDGE = 1;

/** Half width of a machine pad, sprite pixels. */
export const PAD_HALF_WIDTH = 25;
/** How far the pad extends vertically beyond the furniture and the worker spot, sprite pixels. */
export const PAD_MARGIN = 14;
const PAD_FRAME = 1;
const PAD_FRAME_SHADE = -0.3;

/**
 * Floor tile: a checkerboard of four 16-pixel tiles with a 1-pixel seam.
 * @param {Palette["floor"]} floor Floor inks.
 * @returns {PixelImage} A 32×32 image repeated across the floor.
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
 * Aisle strip tile: borders at the edges and a marking dash along the axis.
 * @param {LaneDirection} direction Which axis the strip runs along.
 * @param {Palette["floor"]} floor Floor inks.
 * @returns {PixelImage} An image repeated along the strip.
 */
export function laneTileImage(direction: LaneDirection, floor: Palette["floor"]): PixelImage {
  const across = LANE_HALF_WIDTH * 2;
  const along = DASH.period;
  const isHorizontal = direction === "horizontal";
  const image = blankImage(isHorizontal ? along : across, isHorizontal ? across : along);
  const rect = (x: number, y: number, alongSize: number, acrossSize: number, color: number) => {
    if (isHorizontal) fillRect(image, x, y, alongSize, acrossSize, color);
    else fillRect(image, y, x, acrossSize, alongSize, color);
  };

  rect(0, 0, along, across, floor.lane);
  rect(0, 0, along, LANE_EDGE, floor.grout);
  rect(0, across - LANE_EDGE, along, LANE_EDGE, floor.grout);
  rect(0, (across - DASH.thickness) / 2, DASH.length, DASH.thickness, floor.mark);

  return image;
}

/**
 * A pad under a machine or desk: fill, a 1-pixel frame and cut corners.
 * @param {number} width Width, sprite pixels.
 * @param {number} height Height, sprite pixels.
 * @param {Palette} palette Factory inks.
 * @returns {PixelImage} Pad image.
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
 * Plan pads: one under each machine together with the worker spot, and one under the office desk
 * together with the foreman spot.
 * @param {FactoryLayout} layout Floor plan.
 * @returns {PlanBounds[]} Rectangles in sprite pixels.
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
 * Draws the factory floor in sprite pixels (`PIXELS_PER_UNIT` per plan unit).
 * @param {FactoryLayout} layout Floor plan.
 * @param {Palette} palette Factory inks.
 * @returns {Container} Floor: tiles, the aisle, and machine and office pads.
 * @throws {Error} If a plan aisle runs diagonally.
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
