import type { Stage } from "@cyberzavod/core";
import type { Translated } from "@/shared/i18n/locale.ts";

/** Stage names in the interface: machine plaques and message routes. */
export const STAGE_LABELS: Readonly<Record<Stage, Translated>> = {
  planning: { en: "Plan", ru: "Постановка" },
  implementation: { en: "Code", ru: "Код" },
  review: { en: "Review", ru: "Ревью" },
  verification: { en: "Verify", ru: "Проверки" },
  record: { en: "Record", ru: "Фиксация" },
};

/** Name of the factory foreman (`foreman` in code): on the office plaque and in message routes. */
export const FOREMAN_LABEL: Translated = { en: "Foreman", ru: "Мастер" };
