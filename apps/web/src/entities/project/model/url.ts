import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * Адрес страницы проекта на сайте.
 * @param {string} id Идентификатор проекта.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/projects/split-bill/`, для русского — с префиксом `/ru`.
 */
export function projectUrl(id: string, locale: Locale): string {
  return localizedPath(locale, `/projects/${id}/`);
}
