import { describe, expect, it } from "vitest";
import { statsUrl } from "./url.ts";

describe("statsUrl", () => {
  it.each([
    ["en", "/stats/"],
    ["ru", "/ru/stats/"],
  ] as const)("ведёт на аналитику на языке %s", (locale, expected) => {
    const url = statsUrl(locale);

    expect(url).toBe(expected);
  });
});
