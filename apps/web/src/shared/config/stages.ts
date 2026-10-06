import type { Stage } from "@cyberzavod/core";
import type { Translated } from "@/shared/i18n/locale.ts";

/** Названия этапов в интерфейсе: таблички станков и маршруты реплик. */
export const STAGE_LABELS: Readonly<Record<Stage, Translated>> = {
  spec: { en: "Spec", ru: "Постановка" },
  code: { en: "Code", ru: "Код" },
  test: { en: "Tests", ru: "Проверки" },
  review: { en: "Review", ru: "Ревью" },
  ship: { en: "Ship", ru: "Выпуск" },
};

/** Название мастера цеха (в коде `foreman`) — на табличке кабинета и в маршрутах реплик. */
export const FOREMAN_LABEL: Translated = { en: "Foreman", ru: "Мастер" };
