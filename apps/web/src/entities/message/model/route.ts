import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";

// Подписи участников: этапы — как на табличках, мастер — со строчной буквы, чтобы в середине
// маршрута он читался как слово, а в начале получал заглавную.
const SPEAKER_LABELS: Readonly<Record<Speaker, string>> = {
  ...STAGE_LABELS,
  foreman: FOREMAN_LABEL.toLowerCase(),
};

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Маршрут реплики для подписи: кто кому говорит.
 * @param {BriefMessageEvent} message Реплика из записи.
 * @returns {string} Например «Код → Проверки» или «Постановка → мастер».
 */
export function routeOf(message: BriefMessageEvent): string {
  return `${capitalized(SPEAKER_LABELS[message.from])} → ${SPEAKER_LABELS[message.to]}`;
}
