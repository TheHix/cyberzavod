import { describe, expect, it } from "vitest";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { plaqueImage, plaqueSize } from "./glyphs.ts";
import { testPalette } from "./test-palette.ts";

describe("plaqueImage", () => {
  it.each([...Object.values(STAGE_LABELS), FOREMAN_LABEL])("рисует надпись «%s»", (text) => {
    const image = plaqueImage(text, testPalette());

    expect(image).toMatchObject(plaqueSize(text));
    expect(image.pixels).toHaveLength(image.width * image.height * 4);
  });

  it("делает табличку шире с длиной надписи", () => {
    const palette = testPalette();

    const short = plaqueImage("Код", palette);
    const long = plaqueImage("Постановка", palette);

    expect(long.width).toBeGreaterThan(short.width);
  });

  it("пишет заглавными: строчные буквы дают ту же табличку", () => {
    const palette = testPalette();

    const lower = plaqueImage("мастер", palette);
    const upper = plaqueImage("МАСТЕР", palette);

    expect(lower.pixels).toEqual(upper.pixels);
  });

  it("кладёт контур по краю, бумагу внутрь и тень вниз", () => {
    const palette = testPalette();

    const image = plaqueImage("Код", palette);

    const rowOf = (row: number, column: number) => (row * image.width + column) * 4;
    expect(image.pixels[rowOf(0, 0) + 3]).toBe(0);
    expect(image.pixels[rowOf(0, 1) + 2]).toBe(palette.ink);
    expect(image.pixels[rowOf(1, 1) + 2]).toBe(palette.paper);
    expect(image.pixels[rowOf(image.height - 1, 1) + 2]).toBe(palette.ink);
  });

  it("отклоняет букву без глифа", () => {
    const act = () => plaqueImage("Q", testPalette());

    expect(act).toThrow(/нет буквы «Q»/);
  });
});
