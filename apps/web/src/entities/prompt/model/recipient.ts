import type { PromptEvent } from "@cyberzavod/core";
import { formatModel } from "@/shared/lib/format.ts";

/**
 * Кому человек писал промпт — для подписи «человек → …».
 * @param {PromptEvent} prompt Промпт из записи.
 * @returns {string} Название модели или «агент», если модель неизвестна.
 */
export function recipientOf(prompt: PromptEvent): string {
  return prompt.model === undefined ? "агент" : formatModel(prompt.model);
}
