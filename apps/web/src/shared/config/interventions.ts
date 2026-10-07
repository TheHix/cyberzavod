import type { InterventionReason } from "@cyberzavod/core";
import type { Translated } from "@/shared/i18n/locale.ts";

/** Причины вмешательства человека в интерфейсе: что остановило автоматику и позвало человека. */
export const INTERVENTION_LABELS: Readonly<Record<InterventionReason, Translated>> = {
  question: { en: "answered a question", ru: "ответ на вопрос" },
  plan_review: { en: "plan decision", ru: "решение по постановке" },
  rework_limit: { en: "called after reworks", ru: "вызов после возвратов" },
  stop_gate: { en: "called by stop hook", ru: "вызов хуком остановки" },
};
