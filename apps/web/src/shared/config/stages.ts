import type { Stage } from "@cyberzavod/core";

/** Названия этапов в интерфейсе: таблички станков и маршруты реплик. */
export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  spec: "Постановка",
  code: "Код",
  test: "Проверки",
  review: "Ревью",
  ship: "Выпуск",
};

/** Название мастера — начальника цеха (в коде `conductor`) — на табличке кабинета и в маршрутах. */
export const CONDUCTOR_LABEL = "Мастер";

/** Как называют человека в маршрутах реплик. */
export const HUMAN_LABEL = "человек";
