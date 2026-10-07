// Пиксельный шрифт табличек: заглавные кириллица и латиница из названий этапов, мастера и логотипа.
// Векторный шрифт при целом увеличении размывается, а готовый пиксельный с кириллицей — это ассет
// и лицензия, поэтому глифы лежат здесь строками. Табличку рисуют и цех (в текстуру), и меню
// (в SVG логотипа), поэтому рисунок — строки букв-красок без привязки к графике.

/** Рисунок таблички: строки одной длины, буква — краска из `PLAQUE_INKS`. */
export type PlaqueArt = readonly string[];

/** Буквы красок в рисунке таблички: контур, бумага, затенённая бумага и пустота. */
export const PLAQUE_INKS = {
  ink: "k",
  paper: "p",
  paperShade: "P",
  blank: ".",
} as const;

/** Глифы заглавных букв высотой 5 пикселей: `k` — штрих буквы, `.` — пусто. */
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
  // Латинские буквы того же вида, что кириллические, рисуются так же: на одной табличке и на
  // одной странице не должно быть двух разных «А» шрифта.
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

// Строка надписи пиксельными рядами: буквы через промежуток, пустое — бумага.
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

// Короткая строка встаёт по центру самой длинной.
function centered(row: string, width: number): string {
  const before = Math.floor((width - row.length) / 2);
  return PAPER.repeat(before) + row + PAPER.repeat(width - row.length - before);
}

function paperRows(count: number, width: number): string[] {
  return Array.from({ length: count }, () => PAPER.repeat(width));
}

// Верхний и нижний контур со срезанными углами; тень повторяет нижний.
function edgeRow(width: number): string {
  return BLANK + INK.repeat(width - 2 * OUTLINE) + BLANK;
}

/**
 * Рисует табличку с надписью заглавными: бумага, контур в 1 пиксель, тень вниз в 1 пиксель,
 * буквы через 1 пиксель, строки через 1 пиксель и по центру.
 * @param {readonly string[]} lines Строки надписи; строчные буквы становятся заглавными.
 * @returns {PlaqueArt} Рисунок таблички.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueArt(lines: readonly string[]): PlaqueArt {
  const lineRows = lines.map(lineArt);
  const textWidth = Math.max(0, ...lineRows.map((rows) => rows[0]?.length ?? 0));
  const text = lineRows.flatMap((rows, index) => [
    ...(index === 0 ? [] : paperRows(LINE_GAP, textWidth)),
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

/** Краска таблички, которую видно: всё, кроме пустоты. */
export type PlaqueInk = Exclude<keyof typeof PLAQUE_INKS, "blank">;

/** Подряд идущие пиксели одной краски в строке рисунка: в SVG это один прямоугольник. */
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
 * Делит рисунок таблички на отрезки одной краски по строкам; пустые пиксели пропускает.
 * @param {PlaqueArt} art Рисунок таблички.
 * @returns {PlaqueRun[]} Отрезки сверху вниз и слева направо.
 * @throws {Error} Если в рисунке есть буква не из `PLAQUE_INKS`.
 */
export function plaqueRuns(art: PlaqueArt): PlaqueRun[] {
  return art.flatMap(rowRuns);
}
