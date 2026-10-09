import { API_PAGES } from "@/shared/config/routes.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * The stats page address.
 * @param {Locale} locale Page language.
 * @returns {string} A path like `/stats/`, for Russian `/ru/stats/`.
 */
export function statsUrl(locale: Locale): string {
  return localizedPath(locale, API_PAGES.stats);
}
