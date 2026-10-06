import { readPalette, type Palette } from "./palette.ts";

// Каждому токену — свой цвет, чтобы тест видел, откуда взята краска пикселя.
const TOKEN_NAMES = [
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

/**
 * Палитра для тестов графики: у каждого токена свой цвет.
 * @returns {Palette} Краски цеха.
 */
export function testPalette(): Palette {
  const values = new Map(
    TOKEN_NAMES.map((name, index) => [name, `#0000${(index + 1).toString(16).padStart(2, "0")}`]),
  );
  return readPalette({ getPropertyValue: (name) => values.get(name) ?? "" });
}
