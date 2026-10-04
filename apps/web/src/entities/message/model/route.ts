import type { BriefMessageEvent, Listener } from "@cyberzavod/core";
import { CONDUCTOR_LABEL, HUMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";

// Подписи участников: этапы — как на табличках, мастер и человек — со строчной буквы,
// чтобы в середине маршрута они читались как слова, а в начале получали заглавную.
const LISTENER_LABELS: Readonly<Record<Listener, string>> = {
  ...STAGE_LABELS,
  conductor: CONDUCTOR_LABEL.toLowerCase(),
  human: HUMAN_LABEL,
};

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Маршрут реплики для подписи: кто кому говорит.
 * @param {BriefMessageEvent} message Реплика из записи.
 * @returns {string} Например «Мастер → Код» или «Ревью → мастер»; одно слово, если говорящий
 *   и адресат совпадают.
 */
export function routeOf(message: BriefMessageEvent): string {
  const from = capitalized(LISTENER_LABELS[message.from]);
  if (message.from === message.to) return from;
  return `${from} → ${LISTENER_LABELS[message.to]}`;
}
