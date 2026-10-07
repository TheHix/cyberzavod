import { API_PAGES } from "@/shared/config/routes.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * Адрес страницы аналитики.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/stats/`, для русского — `/ru/stats/`.
 */
export function statsUrl(locale: Locale): string {
  return localizedPath(locale, API_PAGES.stats);
}
