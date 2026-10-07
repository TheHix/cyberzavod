import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import type { Locale } from "@/shared/i18n/locale.ts";

// Подписи участников: этапы — как на табличках, мастер — со строчной буквы, чтобы в середине
// маршрута он читался как слово, а в начале получал заглавную.
function speakerLabel(speaker: Speaker, locale: Locale): string {
  return speaker === "foreman"
    ? FOREMAN_LABEL[locale].toLowerCase()
    : STAGE_LABELS[speaker][locale];
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Маршрут реплики для подписи: кто кому говорит.
 * @param {BriefMessageEvent} message Реплика из записи.
 * @param {Locale} locale Язык подписей.
 * @returns {string} Например «Код → Проверки» или «Постановка → мастер»; по-английски «Plan → foreman».
 */
export function routeOf(message: BriefMessageEvent, locale: Locale): string {
  return `${capitalized(speakerLabel(message.from, locale))} → ${speakerLabel(message.to, locale)}`;
}
