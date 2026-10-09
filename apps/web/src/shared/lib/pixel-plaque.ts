// Pixel font for plaques: uppercase Cyrillic and Latin letters from the stage, foreman and logo
// names. A vector font blurs at integer scaling, and a ready-made pixel font with Cyrillic is an
// asset and a license, so the glyphs live here as strings. Both the factory floor (into a texture)
// and the menu (into the logo SVG) draw plaques, so the art is rows of color letters with no tie to
// the graphics.

/** Plaque art: rows of equal length, each letter a color from `PLAQUE_INKS`. */
export type PlaqueArt = readonly string[];

/** Color letters in plaque art: outline, paper, shaded paper and blank. */
export const PLAQUE_INKS = {
  ink: "k",
  paper: "p",
  paperShade: "P",
  blank: ".",
} as const;

/** Glyphs of uppercase letters 5 pixels high: `k` is a letter stroke, `.` is blank. */
export const PLAQUE_GLYPHS: Readonly<Record<string, PlaqueArt>> = {
  А: [".k.", "k.k", "kkk", "k.k", "k.k"],
  Б: ["kkk", "k..", "kk.", "k.k", "kk."],
  В: ["kk.", "k.k", "kk.", "k.k", "kk."],
  Д: [".kkk.", ".k.k.", ".k.k.", "kkkkk", "k...k"],
  Е: ["kkk", "k..", "kk.", "k..", "kkk"],
  З: ["kk.", "..k", ".k.", "..k", "kk."],
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
  Ф: [".kkk.", "k.k.k", "k.k.k", ".kkk.", "..k.."],
  Ц: ["k.k.", "k.k.", "k.k.", "kkkk", "...k"],
  Ы: ["k....k", "k....k", "kkkk.k", "k...kk", "kkkk.k"],
  Ь: ["k..", "k..", "kk.", "k.k", "kk."],
  Ю: ["k.kk.", "k.k.k", "kkk.k", "k.k.k", "k.kk."],
  Я: [".kk", "k.k", ".kk", "k.k", "k.k"],
  // Latin letters that look like Cyrillic ones are drawn the same: one plaque or one page must
  // not have two different "A" glyphs.
  A: [".k.", "k.k", "kkk", "k.k", "k.k"],
  B: ["kk.", "k.k", "kk.", "k.k", "kk."],
  C: ["kkk", "k..", "k..", "k..", "kkk"],
  D: ["kk.", "k.k", "k.k", "k.k", "kk."],
  E: ["kkk", "k..", "kk.", "k..", "kkk"],
  F: ["kkk", "k..", "kk.", "k..", "k.."],
  H: ["k.k", "k.k", "kkk", "k.k", "k.k"],
  I: ["kkk", ".k.", ".k.", ".k.", "kkk"],
  L: ["k..", "k..", "k..", "k..", "kkk"],
  M: ["k...k", "kk.kk", "k.k.k", "k...k", "k...k"],
  N: ["k...k", "kk..k", "k.k.k", "k..kk", "k...k"],
  O: ["kkk", "k.k", "k.k", "k.k", "kkk"],
  P: ["kkk", "k.k", "kkk", "k..", "k.."],
  R: ["kk.", "k.k", "kk.", "k.k", "k.k"],
  S: [".kk", "k..", ".k.", "..k", "kk."],
  T: ["kkk", ".k.", ".k.", ".k.", ".k."],
  V: ["k.k", "k.k", "k.k", "k.k", ".k."],
  W: ["k...k", "k...k", "k.k.k", "kk.kk", "k...k"],
  Y: ["k.k", "k.k", ".k.", ".k.", ".k."],
  Z: ["kkk", "..k", ".k.", "k..", "kkk"],
};

/**
 * How much darker the paper shade is than the paper, for `shade`: the same on the factory floor
 * plaques, in the menu and in the icons.
 */
export const PLAQUE_PAPER_SHADE = -0.12;

const GLYPH_HEIGHT = 5;
const LETTER_GAP = 1;
const LINE_GAP = 1;
const PADDING_X = 2;
const PADDING_Y = 1;
const OUTLINE = 1;
const SHADOW = 1;
const { ink: INK, paper: PAPER, paperShade: PAPER_SHADE, blank: BLANK } = PLAQUE_INKS;

function glyphOf(letter: string): PlaqueArt {
  const glyph = PLAQUE_GLYPHS[letter];

  if (glyph === undefined) throw new Error(`в шрифте табличек нет буквы «${letter}»`);

  return glyph;
}

// A label line as pixel rows: letters with a gap between them, empty space is paper.
function lineArt(text: string): string[] {
  const letters = [...text.toLocaleUpperCase("ru-RU")].map(glyphOf);
  const gap = BLANK.repeat(LETTER_GAP);

  return Array.from({ length: GLYPH_HEIGHT }, (_, row) =>
    letters
      .map((glyph) => glyph[row] ?? "")
      .join(gap)
      .replaceAll(BLANK, PAPER),
  );
}

// A short line is centered on the longest one.
function centered(row: string, width: number): string {
  const before = Math.floor((width - row.length) / 2);

  return PAPER.repeat(before) + row + PAPER.repeat(width - row.length - before);
}

function paperRows(count: number, width: number): string[] {
  return Array.from({ length: count }, () => PAPER.repeat(width));
}

// Top and bottom outline with cut corners; the shadow repeats the bottom one.
function edgeRow(width: number): string {
  return BLANK + INK.repeat(width - 2 * OUTLINE) + BLANK;
}

/**
 * Draws a plaque with an uppercase label: paper, a 1-pixel outline, a 1-pixel drop shadow,
 * letters 1 pixel apart, lines 1 pixel apart and centered.
 * @param {readonly string[]} lines Label lines; lowercase letters become uppercase.
 * @returns {PlaqueArt} Plaque art.
 * @throws {Error} If the label has a letter without a glyph.
 */
export function plaqueArt(lines: readonly string[]): PlaqueArt {
  const lineRows = lines.map(lineArt);
  const lineWidths = lineRows.map((rows) => rows[0]?.length ?? 0);
  const textWidth = Math.max(0, ...lineWidths);
  const text = lineRows.flatMap((rows, index) => [
    ...paperRows(index === 0 ? 0 : LINE_GAP, textWidth),
    ...rows.map((row) => centered(row, textWidth)),
  ]);
  const inner = [...paperRows(PADDING_Y, textWidth), ...text];
  const margin = PAPER.repeat(PADDING_X);
  const width = textWidth + 2 * (PADDING_X + OUTLINE);

  return [
    edgeRow(width),
    ...inner.map((row) => INK + margin + row + margin + INK),
    ...Array.from({ length: PADDING_Y }, () => INK + PAPER_SHADE.repeat(width - 2 * OUTLINE) + INK),
    edgeRow(width),
    ...Array.from({ length: SHADOW }, () => edgeRow(width)),
  ];
}

/** A visible plaque color: everything except blank. */
export type PlaqueInk = Exclude<keyof typeof PLAQUE_INKS, "blank">;

/** Consecutive pixels of one color in an art row: one rectangle in SVG. */
export interface PlaqueRun {
  readonly ink: PlaqueInk;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const INK_OF_LETTER: Readonly<Record<string, PlaqueInk>> = {
  [INK]: "ink",
  [PAPER]: "paper",
  [PAPER_SHADE]: "paperShade",
};

function inkOf(letter: string): PlaqueInk {
  const ink = INK_OF_LETTER[letter];

  if (ink === undefined) throw new Error(`в рисунке таблички нет краски «${letter}»`);

  return ink;
}

function rowRuns(row: string, y: number): PlaqueRun[] {
  const runs: PlaqueRun[] = [];

  for (const [x, letter] of [...row].entries()) {
    if (letter === BLANK) continue;

    const ink = inkOf(letter);
    const last = runs.at(-1);

    if (last?.ink === ink && last.x + last.width === x) {
      runs[runs.length - 1] = { ...last, width: last.width + 1 };
    } else {
      runs.push({ ink, x, y, width: 1 });
    }
  }

  return runs;
}

/**
 * Splits plaque art into same-color runs row by row; skips blank pixels.
 * @param {PlaqueArt} art Plaque art.
 * @returns {PlaqueRun[]} Runs from top to bottom and left to right.
 * @throws {Error} If the art has a letter not in `PLAQUE_INKS`.
 */
export function plaqueRuns(art: PlaqueArt): PlaqueRun[] {
  return art.flatMap(rowRuns);
}
