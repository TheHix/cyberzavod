import { describe, expect, it } from "vitest";
import { INTERFACE_LANGUAGES, isInterfaceLanguage } from "./interface-language.ts";

describe("isInterfaceLanguage", () => {
  it.each(INTERFACE_LANGUAGES)("принимает поддерживаемый язык %s", (language) => {
    const isSupported = isInterfaceLanguage(language);

    expect(isSupported).toBe(true);
  });

  it.each(["de", "", "RU", "ru_RU", "constructor"])("отклоняет %j", (value) => {
    const isSupported = isInterfaceLanguage(value);

    expect(isSupported).toBe(false);
  });
});
