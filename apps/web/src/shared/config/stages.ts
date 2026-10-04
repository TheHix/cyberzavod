import type { Stage } from "@cyberzavod/core";

/** Названия этапов в интерфейсе: таблички станков и маршруты реплик. */
export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  spec: "Постановка",
  code: "Код",
  test: "Проверки",
  review: "Ревью",
  ship: "Выпуск",
};

/** Название мастера цеха (в коде `foreman`) — на табличке кабинета и в маршрутах реплик. */
export const FOREMAN_LABEL = "Мастер";
