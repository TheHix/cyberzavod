import type { InterventionReason } from "@cyberzavod/core";

/** Причины вмешательства человека в интерфейсе: что остановило автоматику и позвало человека. */
export const INTERVENTION_LABELS: Readonly<Record<InterventionReason, string>> = {
  question: "ответ на вопрос",
  spec_review: "решение по постановке",
  rework_limit: "вызов после возвратов",
  stop_gate: "вызов хуком остановки",
};
