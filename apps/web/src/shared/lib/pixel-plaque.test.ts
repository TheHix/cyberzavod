import { describe, expect, it } from "vitest";
import { LOGO_LINES, LOGO_SHORT_LINES } from "@/shared/config/logo.ts";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { LOCALES } from "@/shared/i18n/locale.ts";
import { PLAQUE_GLYPHS, PLAQUE_INKS, plaqueArt, plaqueRuns } from "./pixel-plaque.ts";

const GLYPH_HEIGHT = 5;
// Latin letters that look like Cyrillic ones: pairs of (Latin, Cyrillic).
const LATIN_TWINS: readonly (readonly [string, string])[] = [
  ["A", "А"],
  ["B", "В"],
  ["C", "С"],
  ["E", "Е"],
  ["H", "Н"],
  ["M", "М"],
  ["O", "О"],
  ["P", "Р"],
  ["T", "Т"],
];

// Every label drawn by the factory floor plaques and the logo, in each language.
const LABEL_CASES = LOCALES.flatMap((locale) =>
  [
    ...Object.values(STAGE_LABELS).map((label) => [label[locale]]),
    [FOREMAN_LABEL[locale]],
    LOGO_LINES[locale],
    LOGO_SHORT_LINES[locale],
  ].map((lines) => ({ locale, lines, text: lines.join(" ") })),
);

const INK_LETTERS = new Set<string>(Object.values(PLAQUE_INKS));

function rowsOfOneWidth(art: readonly string[]): boolean {
  return art.every((row) => row.length === art[0]?.length);
}

describe("PLAQUE_GLYPHS", () => {
  it.each(Object.entries(PLAQUE_GLYPHS))("глиф «%s» — 5 строк одной ширины", (_letter, glyph) => {
    expect(glyph).toHaveLength(GLYPH_HEIGHT);
    expect(rowsOfOneWidth(glyph)).toBe(true);
  });

  it.each(LATIN_TWINS)("латинская «%s» рисуется как кириллическая «%s»", (latin, cyrillic) => {
    expect(PLAQUE_GLYPHS[latin]).toEqual(PLAQUE_GLYPHS[cyrillic]);
  });

  it.each(LABEL_CASES)("есть все буквы надписи «$text» ($locale)", ({ lines }) => {
    const act = () => plaqueArt(lines);

    expect(act).not.toThrow();
  });
});

describe("plaqueArt", () => {
  it("рисует строки одной ширины только красками таблички", () => {
    const art = plaqueArt(["Кибер", "завод"]);

    expect(rowsOfOneWidth(art)).toBe(true);
    expect(
      art
        .join("")
        .split("")
        .every((letter) => INK_LETTERS.has(letter)),
    ).toBe(true);
  });

  it("срезает углы контура и кладёт тень вниз", () => {
    const art = plaqueArt(["Код"]);

    expect(art[0]).toMatch(/^\.k+\.$/);
    expect(art.at(-1)).toBe(art[0]);
    expect(art.at(-2)).toBe(art[0]);
  });

  it("добавляет на вторую строку высоту глифа и промежуток", () => {
    const one = plaqueArt(["КЗ"]);

    const two = plaqueArt(["КЗ", "КЗ"]);

    expect(two.length - one.length).toBe(GLYPH_HEIGHT + 1);
  });

  it("ставит короткую строку по центру длинной", () => {
    const art = plaqueArt(["Постановка", "Код"]);

    const shortRow = art.at(-4) ?? "";
    const before = shortRow.indexOf("k", 1);
    const after = shortRow.length - 1 - shortRow.lastIndexOf("k", shortRow.length - 2);

    expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
  });

  it("пишет заглавными: строчные буквы дают тот же рисунок", () => {
    const lower = plaqueArt(["мастер"]);

    const upper = plaqueArt(["МАСТЕР"]);

    expect(lower).toEqual(upper);
  });

  it("отклоняет букву без глифа", () => {
    const act = () => plaqueArt(["Q"]);

    expect(act).toThrow(/нет буквы «Q»/);
  });
});

describe("plaqueRuns", () => {
  it("склеивает соседние пиксели одной краски и пропускает пустые", () => {
    const runs = plaqueRuns([".kkp", "pP.k"]);

    expect(runs).toEqual([
      { ink: "ink", x: 1, y: 0, width: 2 },
      { ink: "paper", x: 3, y: 0, width: 1 },
      { ink: "paper", x: 0, y: 1, width: 1 },
      { ink: "paperShade", x: 1, y: 1, width: 1 },
      { ink: "ink", x: 3, y: 1, width: 1 },
    ]);
  });

  it("отклоняет букву не из красок таблички", () => {
    const act = () => plaqueRuns(["kxk"]);

    expect(act).toThrow(/нет краски «x»/);
  });

  it("не склеивает одну краску через пустой пиксель", () => {
    const runs = plaqueRuns(["k.k"]);

    expect(runs).toHaveLength(2);
  });
});
