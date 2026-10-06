import type { PromptEvent } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatModel } from "@/shared/lib/format.ts";

/**
 * Кому человек писал промпт — для подписи «человек → …».
 * @param {PromptEvent} prompt Промпт из записи.
 * @param {Locale} locale Язык слова «агент» для случая, когда модель неизвестна.
 * @returns {string} Название модели или «агент», если модель неизвестна.
 */
export function recipientOf(prompt: PromptEvent, locale: Locale): string {
  return prompt.model === undefined ? UI_TEXT.speech.agent[locale] : formatModel(prompt.model);
}
