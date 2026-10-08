import type { Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/**
 * Адрес страницы записи на сайте.
 * @param {string} id Идентификатор записи.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/recordings/2026-10-07-79fd668f/`, для русского — с префиксом `/ru`.
 */
export function recordingUrl(id: string, locale: Locale): string {
  return localizedPath(locale, `/recordings/${id}/`);
}
