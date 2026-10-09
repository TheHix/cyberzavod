import type { PromptEvent } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatModel } from "@/shared/lib/format.ts";

/**
 * Whom the human wrote the prompt to, for the "human → …" caption.
 * @param {PromptEvent} prompt Prompt from the recording.
 * @param {Locale} locale Language of the word "agent" for when the model is unknown.
 * @returns {string} The model name, or "agent" if the model is unknown.
 */
export function recipientOf(prompt: PromptEvent, locale: Locale): string {
  return prompt.model === undefined ? UI_TEXT.speech.agent[locale] : formatModel(prompt.model);
}
