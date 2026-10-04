// Общие данные для тестов сценария и кадра.

import type { FactoryLayout, StationPlan } from "./layout.ts";
import type { FactoryEvent, Listener, MessageEvent, Recording, Speaker } from "./recording.ts";
import type { Pacing } from "./script.ts";

// Станки в ряд через 10 единиц, проход в двух единицах от рабочих мест, бег — единица
// в секунду, работа у станка длится столько же, сколько в записи: моменты сцены считаются
// в уме. Передача соседу: 0,2 с поднять деталь, 13 с пути (2 вниз в проход, 10 по проходу,
// 1 вверх к получателю), 0,1 с из рук в руки, 0,2 с получатель кладёт её на станок.

const AISLE = 2;

/**
 * Станок для тестов: рабочее место в точке, станок на единицу дальше от прохода.
 * @param {number} x Положение по горизонтали.
 * @param {number} y Положение рабочего места по вертикали.
 * @returns {StationPlan} Станок, у которого рабочий смотрит на станок.
 */
export function stationAt(x: number, y = 0): StationPlan {
  const toMachine = y > AISLE ? 1 : -1;
  return { machine: { x, y: y + toMachine }, post: { x, y }, facing: (toMachine * Math.PI) / 2 };
}

/** План для тестов: станки в ряд через 10 единиц, проход в двух единицах от них. */
export const LINE_LAYOUT: FactoryLayout = {
  width: 50,
  height: 10,
  aisle: AISLE,
  stations: {
    spec: stationAt(0),
    code: stationAt(10),
    test: stationAt(20),
    review: stationAt(30),
    ship: stationAt(40),
  },
  conductor: { desk: { x: 20, y: 5 }, post: { x: 20, y: 6 }, facing: -Math.PI / 2 },
};

/** Темп для тестов: без сжатия, бег — единица в секунду. */
export const PLAIN_PACING: Pacing = {
  compression: 1,
  minWorkMs: 0,
  maxWorkMs: Number.POSITIVE_INFINITY,
  walkSpeed: 1,
  handoffMs: 100,
  handoffGap: 1,
  liftMs: 200,
  turnMs: 150,
  promptMs: 1_000,
  messageMs: 1_000,
  finaleMs: 500,
};

/**
 * Запись для тестов: постановка → код → проверки с провалом → снова код.
 * @param {boolean} ok Итог сборки.
 * @returns {Recording} Запись сборки.
 */
export function reworkRecording(ok = true): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    { t: 1_000, type: "prompt", goal: "Добавь счётчик", requirements: [] },
    { t: 2_000, type: "stage_enter", stage: "code" },
    { t: 5_000, type: "stage_enter", stage: "test" },
    { t: 6_000, type: "stage_fail", stage: "test", reason: "проверки не прошли" },
    { t: 6_000, type: "stage_enter", stage: "code" },
    { t: 7_000, type: "usage", tokens: 1_200 },
    { t: 8_000, type: "build_end", ok },
  ];
  return { version: 1, id: "test", startedAt: "2026-10-04T00:00:00.000Z", title: "Тест", events };
}

/**
 * Реплика для тестов: строка и полный текст выводятся из момента.
 * @param {number} t Время записи, мс.
 * @param {Speaker} from Кто говорит.
 * @param {Listener} to Кому адресована.
 * @returns {MessageEvent} Реплика.
 */
export function messageAt(t: number, from: Speaker, to: Listener): MessageEvent {
  return { t, type: "message", from, to, line: `Реплика ${t}`, text: `Полный текст ${t}` };
}

/**
 * Запись для тестов с репликами: три у станка постановки с мастером (задание коду, отчёт,
 * ответ человеку) и одна у станка кода без мастера.
 * @returns {Recording} Запись сборки.
 */
export function chatRecording(): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    messageAt(500, "conductor", "code"),
    messageAt(700, "code", "conductor"),
    messageAt(1_000, "conductor", "human"),
    { t: 2_000, type: "stage_enter", stage: "code" },
    messageAt(3_000, "code", "human"),
    { t: 8_000, type: "build_end", ok: true },
  ];
  return { ...reworkRecording(), events };
}
