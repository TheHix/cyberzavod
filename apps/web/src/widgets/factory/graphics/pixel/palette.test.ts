import { describe, expect, it } from "vitest";
import { parseColor, readPalette, shade, type TokenSource } from "./palette.ts";

// Все токены, которые читает цех, — каждый своим цветом, чтобы было видно, что откуда взято.
function tokens(overrides: Record<string, string> = {}): TokenSource {
  const names = [
    "--ink",
    "--ink-soft",
    "--paper",
    "--sky",
    "--tangerine",
    "--mint",
    "--grape",
    "--bubblegum",
    "--floor",
    "--floor-tile-alt",
    "--floor-grout",
    "--floor-lane",
    "--sun",
    "--floor-pad",
    "--skin",
    "--crate",
    "--crate-plank",
    "--foreman",
    "--screen",
    "--screen-glass",
    "--belt",
    "--lamp-on",
    "--danger",
    "--foreman-helmet",
    "--white",
  ];
  const values = Object.fromEntries(
    names.map((name, index) => [name, `#0000${index.toString(16).padStart(2, "0")}`]),
  );
  return { getPropertyValue: (name) => overrides[name] ?? values[name] ?? "" };
}

describe("parseColor", () => {
  it("переводит цвет токена в число, не глядя на пробелы вокруг", () => {
    const color = parseColor(" #1d1B33 ");

    expect(color).toBe(0x1d1b33);
  });

  it("разворачивает короткую запись, до которой сборка сжимает белый", () => {
    const color = parseColor("#fA0");

    expect(color).toBe(0xffaa00);
  });

  it.each(["", "red", "#ffff", "#ffffff0", "rgb(0 0 0)"])("отклоняет «%s»", (value) => {
    const act = () => parseColor(value);

    expect(act).toThrow(/#rrggbb/);
  });
});

describe("readPalette", () => {
  it("берёт краски станков из токенов этапов", () => {
    const source = tokens({ "--sky": "#3fc1ff", "--bubblegum": "#ff5ca8" });

    const palette = readPalette(source);

    expect([palette.stations.planning, palette.stations.record]).toEqual([0x3fc1ff, 0xff5ca8]);
  });

  it("берёт пол из того же токена, что и фон страницы", () => {
    const source = tokens({ "--floor": "#7d8fe3" });

    const palette = readPalette(source);

    expect(palette.floor.tile).toBe(0x7d8fe3);
  });

  it("берёт форму мастера из токена, которого нет у этапов", () => {
    const source = tokens({ "--foreman": "#d7263d" });

    const palette = readPalette(source);

    expect(Object.values(palette.stations)).not.toContain(palette.foreman);
    expect(palette.foreman).toBe(0xd7263d);
  });

  it("берёт белый и каску мастера из токенов, а не из кода", () => {
    const source = tokens({ "--white": "#fefefe", "--foreman-helmet": "#eeeeee" });

    const palette = readPalette(source);

    expect([palette.white, palette.foremanHelmet]).toEqual([0xfefefe, 0xeeeeee]);
  });

  it("падает, если токена нет", () => {
    const source = tokens({ "--belt": "" });

    const act = () => readPalette(source);

    expect(act).toThrow(/#rrggbb/);
  });
});

describe("shade", () => {
  it.each([
    [0x808080, 0, 0x808080],
    [0x808080, -1, 0x000000],
    [0x808080, 1, 0xffffff],
    [0x204060, -0.5, 0x102030],
  ])("цвет %s со сдвигом %s становится %s", (color, amount, expected) => {
    const result = shade(color, amount);

    expect(result).toBe(expected);
  });
});
