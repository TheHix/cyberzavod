import type { BriefInterventionEvent } from "@cyberzavod/core";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Метка вмешательства для пузыря и журнала: кто и почему вмешался.
 * @param {BriefInterventionEvent} intervention Вмешательство из записи.
 * @param {Locale} locale Язык метки.
 * @returns {string} Например «человек · ответ на вопрос»; по-английски «human · answered a question».
 */
export function labelOf(intervention: BriefInterventionEvent, locale: Locale): string {
  return `${UI_TEXT.speech.human[locale]} · ${INTERVENTION_LABELS[intervention.reason][locale]}`;
}
