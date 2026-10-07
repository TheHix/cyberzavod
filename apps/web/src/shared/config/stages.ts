import type { Stage } from "@cyberzavod/core";
import type { Translated } from "@/shared/i18n/locale.ts";

/** Названия этапов в интерфейсе: таблички станков и маршруты реплик. */
export const STAGE_LABELS: Readonly<Record<Stage, Translated>> = {
  planning: { en: "Plan", ru: "Постановка" },
  implementation: { en: "Code", ru: "Код" },
  review: { en: "Review", ru: "Ревью" },
  verification: { en: "Verify", ru: "Проверки" },
  record: { en: "Record", ru: "Фиксация" },
};

/** Название мастера цеха (в коде `foreman`) — на табличке кабинета и в маршрутах реплик. */
export const FOREMAN_LABEL: Translated = { en: "Foreman", ru: "Мастер" };
