import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatLanguage } from "./format.ts";

/**
 * Пометка о языке оригинала записи: запись не переводится, и зритель на другом языке должен
 * знать, почему тексты не на языке страницы.
 * @param {string} language Язык записи — `data.language`.
 * @param {Locale} locale Язык страницы.
 * @returns {string | undefined} Пометка вида «recorded in Russian» или `undefined`, если запись
 *   на языке страницы.
 */
export function languageNoteOf(language: string, locale: Locale): string | undefined {
  if (language === locale) return undefined;

  return UI_TEXT.recording.language[locale](formatLanguage(language, locale));
}
