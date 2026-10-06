import type { BriefInterventionEvent } from "@cyberzavod/core";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";

/**
 * Метка вмешательства для пузыря и журнала: кто и почему вмешался.
 * @param {BriefInterventionEvent} intervention Вмешательство из записи.
 * @returns {string} Например «человек · ответ на вопрос».
 */
export function labelOf(intervention: BriefInterventionEvent): string {
  return `человек · ${INTERVENTION_LABELS[intervention.reason]}`;
}
