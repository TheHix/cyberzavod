import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * Адрес страницы гайда на сайте.
 * @param {string} id Идентификатор гайда.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/guides/connect-project/`, для русского — с префиксом `/ru`.
 */
export function guideUrl(id: string, locale: Locale): string {
  return localizedPath(locale, `/guides/${id}/`);
}
