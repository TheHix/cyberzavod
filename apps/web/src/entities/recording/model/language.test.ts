import { describe, expect, it } from "vitest";
import { languageNoteOf } from "./language.ts";

describe("languageNoteOf", () => {
  it.each([
    ["ru", "en", "recorded in Russian"],
    ["en", "ru", "язык записи: английский"],
  ] as const)("помечает запись на %s на странице %s", (language, locale, expected) => {
    const note = languageNoteOf(language, locale);

    expect(note).toBe(expected);
  });

  it.each(["en", "ru"] as const)("не помечает запись на языке страницы %s", (locale) => {
    const note = languageNoteOf(locale, locale);

    expect(note).toBeUndefined();
  });
});
