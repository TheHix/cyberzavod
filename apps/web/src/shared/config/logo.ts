import type { Translated } from "@/shared/i18n/locale.ts";

/** Logo text in the menu: a plaque in the pixel font, like the machines on the factory floor. */
export const LOGO_LINES: Translated<readonly string[]> = {
  en: ["Cyber", "Zavod"],
  ru: ["Кибер", "завод"],
};

/** Short logo for a cramped screen, where the full plaque does not fit in the menu. */
export const LOGO_SHORT_LINES: Translated<readonly string[]> = {
  en: ["CZ"],
  ru: ["КЗ"],
};
