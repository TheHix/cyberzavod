import { describe, expect, it } from "vitest";
import { formatColor, parseColor, shade } from "./color.ts";

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

describe("formatColor", () => {
  it.each([
    [0x1d1b33, "#1d1b33"],
    [0x0000ff, "#0000ff"],
    [0, "#000000"],
  ])("цвет %s записывает как %s", (color, expected) => {
    const result = formatColor(color);

    expect(result).toBe(expected);
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
