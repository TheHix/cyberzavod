import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatLanguage } from "./format.ts";

/**
 * Note on a recording's original language: recordings are not translated, and a viewer in another
 * language should know why the texts are not in the page language.
 * @param {string} language Recording language: `data.language`.
 * @param {Locale} locale Page language.
 * @returns {string | undefined} A note like "recorded in Russian", or `undefined` if the recording
 *   is in the page language.
 */
export function languageNoteOf(language: string, locale: Locale): string | undefined {
  if (language === locale) return undefined;

  return UI_TEXT.recording.language[locale](formatLanguage(language, locale));
}
