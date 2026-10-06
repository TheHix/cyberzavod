import { describe, expect, it } from "vitest";
import { byLocale, otherLocales } from "./locale.ts";

describe("otherLocales", () => {
  it.each([
    ["en", ["ru"]],
    ["ru", ["en"]],
  ] as const)("для языка %s отдаёт остальные: %j", (locale, expected) => {
    const others = otherLocales(locale);

    expect(others).toEqual(expected);
  });
});

describe("byLocale", () => {
  it("строит значение для каждого языка сайта", () => {
    const tags = byLocale((locale) => `tag-${locale}`);

    expect(tags).toEqual({ en: "tag-en", ru: "tag-ru" });
  });
});
