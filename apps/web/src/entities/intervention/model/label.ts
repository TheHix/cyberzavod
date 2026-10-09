import type { BriefInterventionEvent } from "@cyberzavod/core";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";

/**
 * Intervention label for the bubble and the journal: who intervened and why.
 * @param {BriefInterventionEvent} intervention Intervention from the recording.
 * @param {Locale} locale Label language.
 * @returns {string} E.g. «человек · ответ на вопрос»; in English «human · answered a question».
 */
export function labelOf(intervention: BriefInterventionEvent, locale: Locale): string {
  return `${UI_TEXT.speech.human[locale]} · ${INTERVENTION_LABELS[intervention.reason][locale]}`;
}
