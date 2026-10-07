import type { Translated } from "@/shared/i18n/locale.ts";

/** Надпись логотипа в меню — табличка пиксельным шрифтом, как у станков в цехе. */
export const LOGO_LINES: Translated<readonly string[]> = {
  en: ["Cyber", "Zavod"],
  ru: ["Кибер", "завод"],
};

/** Сокращение логотипа для тесного экрана, где полная табличка не помещается в меню. */
export const LOGO_SHORT_LINES: Translated<readonly string[]> = {
  en: ["CZ"],
  ru: ["КЗ"],
};
