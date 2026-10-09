// Pixel sprite format: an array of strings, a letter is an ink. Pure code without Pixi: strings
// turn into colors here, and into a texture in textures.ts.

import { shade } from "@/shared/lib/color.ts";
import { PLAQUE_PAPER_SHADE } from "@/shared/lib/pixel-plaque.ts";
import type { Palette } from "./palette.ts";

/** Semantic ink of a sprite: which token and which `shade()` step stand behind a letter. */
export type Ink =
  | "outline"
  | "soft"
  | "white"
  | "skin"
  | "helmet"
  | "helmetShade"
  | "helmetLight"
  | "uniform"
  | "uniformShade"
  | "uniformLight"
  | "body"
  | "bodyShade"
  | "bodyLight"
  | "screen"
  | "screenGlass"
  | "paper"
  | "paperShade"
  | "wood"
  | "woodShade"
  | "woodLight"
  | "belt"
  | "lampOff"
  | "lampOn"
  | "planning"
  | "implementation"
  | "verification"
  | "review"
  | "record";

/** Sprite inks as 0xRRGGBB numbers. */
export type Inks = Readonly<Record<Ink, number>>;

/** A sprite: strings of equal length, each letter is an ink per `ART_LEGEND`. */
export type SpriteArt = readonly string[];

/** A sprite letter and its ink; `null` is a transparent pixel. */
export const ART_LEGEND: Readonly<Record<string, Ink | null>> = {
  ".": null,
  k: "outline",
  i: "soft",
  "*": "white",
  s: "skin",
  h: "helmet",
  H: "helmetShade",
  j: "helmetLight",
  u: "uniform",
  U: "uniformShade",
  v: "uniformLight",
  b: "body",
  B: "bodyShade",
  l: "bodyLight",
  g: "screen",
  G: "screenGlass",
  p: "paper",
  P: "paperShade",
  w: "wood",
  W: "woodShade",
  y: "woodLight",
  t: "belt",
  o: "lampOff",
  O: "lampOn",
  "1": "planning",
  "2": "implementation",
  "3": "verification",
  "4": "review",
  "5": "record",
};

/** A ready image: RGBA pixels in a row, line after line. */
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** Sprite size in pixels. */
export interface ArtSize {
  readonly width: number;
  readonly height: number;
}

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;
const CHANNEL_MASK = 0xff;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
// Volume steps: the dark face and the highlight come from one ink, so a thing reads as one color.
const SHADE_DEEP = -0.3;
const SHADE_LIGHT = 0.4;
const SHADE_HELMET = -0.25;
const SHADE_HELMET_LIGHT = 0.45;
const SHADE_WOOD_LIGHT = 0.35;

/**
 * Dark step of an ink: a face in shadow.
 * @param {number} color Ink 0xRRGGBB.
 * @returns {number} A darker ink.
 */
export function darker(color: number): number {
  return shade(color, SHADE_DEEP);
}

/**
 * Light step of an ink: a highlight.
 * @param {number} color Ink 0xRRGGBB.
 * @returns {number} A lighter ink.
 */
export function lighter(color: number): number {
  return shade(color, SHADE_LIGHT);
}

/**
 * Helmet inks of one color: the helmet itself, its shade and highlight.
 * @param {number} color Helmet color 0xRRGGBB.
 * @returns {Pick<Inks, "helmet" | "helmetShade" | "helmetLight">} Helmet inks.
 */
export function helmetInks(color: number): Pick<Inks, "helmet" | "helmetShade" | "helmetLight"> {
  return {
    helmet: color,
    helmetShade: shade(color, SHADE_HELMET),
    helmetLight: shade(color, SHADE_HELMET_LIGHT),
  };
}

/**
 * Default inks from the factory palette. A machine and a worker override their own: `body*` is the
 * casing color, `uniform*` the uniform, `helmet*` the helmet.
 * @param {Palette} palette Factory inks.
 * @returns {Inks} All sprite inks.
 */
export function paletteInks(palette: Palette): Inks {
  return {
    outline: palette.ink,
    soft: palette.inkSoft,
    white: palette.white,
    skin: palette.skin,
    ...helmetInks(palette.helmet),
    uniform: palette.paper,
    uniformShade: darker(palette.paper),
    uniformLight: lighter(palette.paper),
    body: palette.paper,
    bodyShade: darker(palette.paper),
    bodyLight: lighter(palette.paper),
    screen: palette.screen,
    screenGlass: palette.screenGlass,
    paper: palette.paper,
    paperShade: shade(palette.paper, PLAQUE_PAPER_SHADE),
    wood: palette.crate.wood,
    woodShade: palette.crate.plank,
    woodLight: shade(palette.crate.wood, SHADE_WOOD_LIGHT),
    belt: palette.belt,
    lampOff: palette.lamp.off,
    lampOn: palette.lamp.on,
    ...palette.stations,
  };
}

/**
 * Sprite size.
 * @param {SpriteArt} art Sprite as strings.
 * @returns {ArtSize} Width from the first string, height as the number of strings.
 */
export function artSize(art: SpriteArt): ArtSize {
  return { width: art[0]?.length ?? 0, height: art.length };
}

/**
 * Paints a sprite: each letter becomes a pixel of its ink, a dot becomes transparent.
 * @param {SpriteArt} art Sprite as strings.
 * @param {Inks} inks Inks by meaning.
 * @returns {PixelImage} RGBA image.
 * @throws {Error} If the sprite is empty, the strings differ in length, or an unknown letter
 *   occurs.
 */
export function paintArt(art: SpriteArt, inks: Inks): PixelImage {
  const { width, height } = artSize(art);

  if (width === 0) throw new Error("рисунок пуст");

  const pixels = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);

  for (const [row, line] of art.entries()) {
    if (line.length !== width) {
      throw new Error(`строка ${row} длиной ${line.length}, а в рисунке ${width}`);
    }

    paintRow(pixels, { row, line, width }, inks);
  }

  return { width, height, pixels };
}

interface ArtRow {
  readonly row: number;
  readonly line: string;
  readonly width: number;
}

function paintRow(pixels: Uint8ClampedArray, { row, line, width }: ArtRow, inks: Inks): void {
  for (const [column, letter] of [...line].entries()) {
    const ink = ART_LEGEND[letter];

    if (ink === undefined) throw new Error(`в рисунке неизвестная буква «${letter}»`);
    if (ink === null) continue;

    const at = (row * width + column) * BYTES_PER_PIXEL;

    setPixel(pixels, at, inks[ink]);
  }
}

function setPixel(pixels: Uint8ClampedArray, at: number, color: number): void {
  pixels[at] = (color >> RED_SHIFT) & CHANNEL_MASK;
  pixels[at + 1] = (color >> GREEN_SHIFT) & CHANNEL_MASK;
  pixels[at + 2] = color & CHANNEL_MASK;
  pixels[at + 3] = OPAQUE;
}

/**
 * A transparent image of the given size: the base for tiles and pads drawn by code.
 * @param {number} width Width, pixels.
 * @param {number} height Height, pixels.
 * @returns {PixelImage} An image without a single painted pixel.
 */
export function blankImage(width: number, height: number): PixelImage {
  return { width, height, pixels: new Uint8ClampedArray(width * height * BYTES_PER_PIXEL) };
}

/**
 * Fills a rectangle with one ink; the part beyond the image edge is discarded.
 * @param {PixelImage} image Image changed in place.
 * @param {number} left Left edge of the rectangle, pixels.
 * @param {number} top Top edge of the rectangle, pixels.
 * @param {number} width Rectangle width, pixels.
 * @param {number} height Rectangle height, pixels.
 * @param {number} color Ink 0xRRGGBB.
 */
export function fillRect(
  image: PixelImage,
  left: number,
  top: number,
  width: number,
  height: number,
  color: number,
): void {
  const right = Math.min(left + width, image.width);
  const bottom = Math.min(top + height, image.height);

  for (let row = Math.max(top, 0); row < bottom; row++) {
    for (let column = Math.max(left, 0); column < right; column++) {
      setPixel(image.pixels, (row * image.width + column) * BYTES_PER_PIXEL, color);
    }
  }
}

/**
 * Makes a pixel transparent: this is how the corners of tiles and pads are cut.
 * @param {PixelImage} image Image changed in place.
 * @param {number} column Pixel column.
 * @param {number} row Pixel row.
 */
export function clearPixel(image: PixelImage, column: number, row: number): void {
  const at = (row * image.width + column) * BYTES_PER_PIXEL;

  image.pixels.fill(0, at, at + BYTES_PER_PIXEL);
}
