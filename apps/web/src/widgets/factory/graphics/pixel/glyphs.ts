// Пиксельный шрифт табличек: только заглавные буквы из названий этапов и мастера. Векторный
// шрифт при целом увеличении размывается, а готовый пиксельный с кириллицей — это ассет
// и лицензия, поэтому глифы лежат здесь строками.

import { paintArt, paletteInks, type ArtSize, type PixelImage, type SpriteArt } from "./art.ts";
import type { Palette } from "./palette.ts";

/** Глифы заглавных букв высотой 5 пикселей: `k` — штрих буквы, `.` — пусто. */
export const PLAQUE_GLYPHS: Readonly<Record<string, SpriteArt>> = {
  А: [".k.", "k.k", "kkk", "k.k", "k.k"],
  В: ["kk.", "k.k", "kk.", "k.k", "kk."],
  Д: [".kkk.", ".k.k.", ".k.k.", "kkkkk", "k...k"],
  Е: ["kkk", "k..", "kk.", "k..", "kkk"],
  И: ["k...k", "k..kk", "k.k.k", "kk..k", "k...k"],
  К: ["k..k", "k.k.", "kk..", "k.k.", "k..k"],
  М: ["k...k", "kk.kk", "k.k.k", "k...k", "k...k"],
  Н: ["k.k", "k.k", "kkk", "k.k", "k.k"],
  О: ["kkk", "k.k", "k.k", "k.k", "kkk"],
  П: ["kkk", "k.k", "k.k", "k.k", "k.k"],
  Р: ["kkk", "k.k", "kkk", "k..", "k.."],
  С: ["kkk", "k..", "k..", "k..", "kkk"],
  Т: ["kkk", ".k.", ".k.", ".k.", ".k."],
  У: ["k.k", "k.k", "kkk", "..k", "kk."],
  Ы: ["k....k", "k....k", "kkkk.k", "k...kk", "kkkk.k"],
  Ь: ["k..", "k..", "kk.", "k.k", "kk."],
  Ю: ["k.kk.", "k.k.k", "kkk.k", "k.k.k", "k.kk."],
};

const GLYPH_HEIGHT = 5;
const LETTER_GAP = 1;
const PADDING_X = 2;
const PADDING_Y = 1;
const OUTLINE = 1;
const SHADOW = 1;
const PAPER_ROW = "p";
const BLANK = ".";
const INK = "k";
const SHADED_PAPER = "P";

function glyphOf(letter: string): SpriteArt {
  const glyph = PLAQUE_GLYPHS[letter];
  if (glyph === undefined) throw new Error(`в шрифте табличек нет буквы «${letter}»`);
  return glyph;
}

function lettersOf(text: string): SpriteArt[] {
  return [...text.toLocaleUpperCase("ru-RU")].map(glyphOf);
}

/**
 * Размер таблички с надписью: бумага, поля, контур и тень вниз.
 * @param {string} text Надпись.
 * @returns {ArtSize} Ширина и высота в пикселях рисунка.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueSize(text: string): ArtSize {
  const letters = lettersOf(text);
  const gaps = Math.max(letters.length - 1, 0) * LETTER_GAP;
  const textWidth = letters.reduce((sum, glyph) => sum + (glyph[0]?.length ?? 0), 0) + gaps;
  return {
    width: textWidth + 2 * (PADDING_X + OUTLINE),
    height: GLYPH_HEIGHT + 2 * (PADDING_Y + OUTLINE) + SHADOW,
  };
}

// Верхний и нижний контур со срезанными углами; тень повторяет нижний.
function edgeRow(width: number): string {
  return BLANK + INK.repeat(width - 2) + BLANK;
}

function paperRow(width: number, fill: string): string {
  return INK + fill.repeat(width - 2) + INK;
}

function textRow(letters: readonly SpriteArt[], row: number): string {
  const gap = BLANK.repeat(LETTER_GAP);
  const line = letters.map((glyph) => glyph[row] ?? "").join(gap);
  return (
    INK +
    PAPER_ROW.repeat(PADDING_X) +
    line.replaceAll(BLANK, PAPER_ROW) +
    PAPER_ROW.repeat(PADDING_X) +
    INK
  );
}

/**
 * Рисует табличку с надписью заглавными: бумага, контур в 1 пиксель, тень вниз в 1 пиксель,
 * буквы через 1 пиксель.
 * @param {string} text Надпись; строчные буквы становятся заглавными.
 * @param {Palette} palette Краски цеха.
 * @returns {PixelImage} Картинка таблички.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueImage(text: string, palette: Palette): PixelImage {
  const letters = lettersOf(text);
  const { width } = plaqueSize(text);
  const art: string[] = [
    edgeRow(width),
    ...Array.from({ length: PADDING_Y }, () => paperRow(width, PAPER_ROW)),
    ...Array.from({ length: GLYPH_HEIGHT }, (_, row) => textRow(letters, row)),
    ...Array.from({ length: PADDING_Y }, () => paperRow(width, SHADED_PAPER)),
    edgeRow(width),
    ...Array.from({ length: SHADOW }, () => edgeRow(width)),
  ];
  return paintArt(art, paletteInks(palette));
}
