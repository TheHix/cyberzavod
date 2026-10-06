// Формат пиксельного рисунка: массив строк, буква — краска. Чистый код без Pixi: строки
// превращаются в цвета здесь, а в текстуру — в textures.ts.

import { shade, type Palette } from "./palette.ts";

/** Смысловая краска рисунка: какой токен и какая ступень `shade()` лежат за буквой. */
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
  | "spec"
  | "code"
  | "test"
  | "review"
  | "ship";

/** Краски рисунка числами 0xRRGGBB. */
export type Inks = Readonly<Record<Ink, number>>;

/** Рисунок: строки одной длины, каждая буква — краска по `ART_LEGEND`. */
export type SpriteArt = readonly string[];

/** Буква рисунка и её краска; `null` — прозрачный пиксель. */
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
  "1": "spec",
  "2": "code",
  "3": "test",
  "4": "review",
  "5": "ship",
};

/** Готовая картинка: пиксели RGBA подряд, строка за строкой. */
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** Размер рисунка в пикселях. */
export interface ArtSize {
  readonly width: number;
  readonly height: number;
}

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;
const CHANNEL_MASK = 0xff;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
// Ступени объёма: тёмная грань и блик — от одной краски, чтобы вещь читалась одним цветом.
const SHADE_DEEP = -0.3;
const SHADE_LIGHT = 0.4;
const SHADE_PAPER = -0.12;
const SHADE_HELMET = -0.25;
const SHADE_HELMET_LIGHT = 0.45;
const SHADE_WOOD_LIGHT = 0.35;

/**
 * Тёмная ступень краски: грань в тени.
 * @param {number} color Краска 0xRRGGBB.
 * @returns {number} Краска темнее.
 */
export function darker(color: number): number {
  return shade(color, SHADE_DEEP);
}

/**
 * Светлая ступень краски: блик.
 * @param {number} color Краска 0xRRGGBB.
 * @returns {number} Краска светлее.
 */
export function lighter(color: number): number {
  return shade(color, SHADE_LIGHT);
}

/**
 * Краски каски одного цвета: сама каска, её тень и блик.
 * @param {number} color Цвет каски 0xRRGGBB.
 * @returns {Pick<Inks, "helmet" | "helmetShade" | "helmetLight">} Краски каски.
 */
export function helmetInks(color: number): Pick<Inks, "helmet" | "helmetShade" | "helmetLight"> {
  return {
    helmet: color,
    helmetShade: shade(color, SHADE_HELMET),
    helmetLight: shade(color, SHADE_HELMET_LIGHT),
  };
}

/**
 * Краски по умолчанию из палитры цеха. Станок и рабочий подменяют свои: `body*` — цвет корпуса,
 * `uniform*` — форма, `helmet*` — каска.
 * @param {Palette} palette Краски цеха.
 * @returns {Inks} Все краски рисунков.
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
    paperShade: shade(palette.paper, SHADE_PAPER),
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
 * Размер рисунка.
 * @param {SpriteArt} art Рисунок строками.
 * @returns {ArtSize} Ширина — по первой строке, высота — число строк.
 */
export function artSize(art: SpriteArt): ArtSize {
  return { width: art[0]?.length ?? 0, height: art.length };
}

/**
 * Красит рисунок: каждая буква становится пикселем своей краски, точка — прозрачным.
 * @param {SpriteArt} art Рисунок строками.
 * @param {Inks} inks Краски по смыслу.
 * @returns {PixelImage} Картинка RGBA.
 * @throws {Error} Если рисунок пуст, строки разной длины или встретилась неизвестная буква.
 */
export function paintArt(art: SpriteArt, inks: Inks): PixelImage {
  const { width, height } = artSize(art);
  if (width === 0) throw new Error("рисунок пуст");
  const pixels = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
  for (const [row, line] of art.entries()) {
    if (line.length !== width) {
      throw new Error(`строка ${row} длиной ${line.length}, а в рисунке ${width}`);
    }
    for (const [column, letter] of [...line].entries()) {
      const ink = ART_LEGEND[letter];
      if (ink === undefined) throw new Error(`в рисунке неизвестная буква «${letter}»`);
      if (ink === null) continue;
      const at = (row * width + column) * BYTES_PER_PIXEL;
      setPixel(pixels, at, inks[ink]);
    }
  }
  return { width, height, pixels };
}

function setPixel(pixels: Uint8ClampedArray, at: number, color: number): void {
  pixels[at] = (color >> RED_SHIFT) & CHANNEL_MASK;
  pixels[at + 1] = (color >> GREEN_SHIFT) & CHANNEL_MASK;
  pixels[at + 2] = color & CHANNEL_MASK;
  pixels[at + 3] = OPAQUE;
}

/**
 * Прозрачная картинка заданного размера: основа для плиток и площадок, которые рисуются кодом.
 * @param {number} width Ширина, пиксели.
 * @param {number} height Высота, пиксели.
 * @returns {PixelImage} Картинка без единого закрашенного пикселя.
 */
export function blankImage(width: number, height: number): PixelImage {
  return { width, height, pixels: new Uint8ClampedArray(width * height * BYTES_PER_PIXEL) };
}

/**
 * Закрашивает прямоугольник одной краской; часть за краем картинки отбрасывается.
 * @param {PixelImage} image Картинка, которая меняется на месте.
 * @param {number} left Левый край прямоугольника, пиксели.
 * @param {number} top Верхний край прямоугольника, пиксели.
 * @param {number} width Ширина прямоугольника, пиксели.
 * @param {number} height Высота прямоугольника, пиксели.
 * @param {number} color Краска 0xRRGGBB.
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
 * Делает пиксель прозрачным: так срезаются углы плиток и площадок.
 * @param {PixelImage} image Картинка, которая меняется на месте.
 * @param {number} column Столбец пикселя.
 * @param {number} row Строка пикселя.
 */
export function clearPixel(image: PixelImage, column: number, row: number): void {
  const at = (row * image.width + column) * BYTES_PER_PIXEL;
  image.pixels.fill(0, at, at + BYTES_PER_PIXEL);
}
