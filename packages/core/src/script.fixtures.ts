// Общие данные для тестов сценария и кадра.

import { FACTORY_LAYOUTS, type FactoryLayout, type StationPlan } from "./layout.ts";
import type { FactoryEvent, MessageEvent, Recording, Speaker } from "./recording.ts";
import { DEFAULT_PACING, type Pacing } from "./script.ts";

// Станки в ряд через 10 единиц, проход в двух единицах от рабочих мест, бег — единица
// в секунду, работа у станка длится столько же, сколько в записи: моменты сцены считаются
// в уме. Передача соседу: 0,2 с поднять деталь, 13 с пути (2 вниз в проход, 10 по проходу,
// 1 вверх к получателю), 0,1 с из рук в руки, 0,2 с получатель кладёт её на станок.

const AISLE = 2;

/**
 * Станок для тестов: рабочее место в точке, станок на единицу дальше от прохода, мастер встаёт
 * в трёх единицах правее рабочего.
 * @param {number} x Положение по горизонтали.
 * @param {number} y Положение рабочего места по вертикали.
 * @returns {StationPlan} Станок, у которого рабочий смотрит на станок.
 */
export function stationAt(x: number, y = 0): StationPlan {
  const toMachine = y > AISLE ? 1 : -1;
  return {
    machine: { x, y: y + toMachine },
    post: { x, y },
    facing: (toMachine * Math.PI) / 2,
    foremanPost: { x: x + 3, y },
  };
}

/** План для тестов: станки в ряд через 10 единиц, проход в двух единицах от них. */
export const LINE_LAYOUT: FactoryLayout = {
  width: 50,
  height: 10,
  minFieldAspect: 0,
  aisle: [
    { x: -10, y: AISLE },
    { x: 60, y: AISLE },
  ],
  stations: {
    spec: stationAt(0),
    code: stationAt(10),
    test: stationAt(20),
    review: stationAt(30),
    ship: stationAt(40),
  },
  foreman: {
    desk: { x: 20, y: 5 },
    post: { x: 20, y: 6 },
    facing: -Math.PI / 2,
    door: { x: 22, y: 6 },
  },
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
  foremanLingerMs: 500,
  finaleMs: 500,
};

/**
 * Запись для тестов без разговоров: постановка → код → проверки с провалом → снова код.
 * @param {boolean} ok Итог сборки.
 * @returns {Recording} Запись сборки.
 */
export function reworkRecording(ok = true): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    { t: 2_000, type: "stage_enter", stage: "code" },
    { t: 5_000, type: "stage_enter", stage: "test" },
    { t: 6_000, type: "stage_fail", stage: "test", reason: "проверки не прошли" },
    { t: 6_000, type: "stage_enter", stage: "code" },
    { t: 7_000, type: "usage", tokens: 1_200 },
    { t: 8_000, type: "build_end", ok },
  ];
  return {
    version: 2,
    id: "test",
    project: "test",
    factory: "0.0.0",
    startedAt: "2026-10-04T00:00:00.000Z",
    title: "Тест",
    events,
  };
}

/**
 * Реплика для тестов: строка и полный текст выводятся из момента.
 * @param {number} t Время записи, мс.
 * @param {Speaker} from Кто говорит.
 * @param {Speaker} to Кому адресована.
 * @returns {MessageEvent} Реплика.
 */
export function messageAt(t: number, from: Speaker, to: Speaker): MessageEvent {
  return { t, type: "message", from, to, line: `Реплика ${t}`, text: `Полный текст ${t}` };
}

/**
 * Запись для тестов с репликами: промпт и «принял» рабочего у станка постановки, у станка кода
 * мастер-слушатель и обмен кода с проверками при передаче, у станка проверок отчёт мастеру.
 * @returns {Recording} Запись сборки.
 */
export function chatRecording(): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    { t: 500, type: "prompt", goal: "Добавь счётчик", requirements: [] },
    messageAt(600, "spec", "foreman"),
    { t: 1_000, type: "stage_enter", stage: "code" },
    messageAt(1_500, "code", "foreman"),
    messageAt(3_000, "code", "test"),
    messageAt(3_500, "test", "code"),
    { t: 4_000, type: "stage_enter", stage: "test" },
    messageAt(5_000, "test", "foreman"),
    { t: 8_000, type: "build_end", ok: true },
  ];
  return { ...reworkRecording(), events };
}

/**
 * Запись для тестов с обменом при возврате с браком: проверки и код говорят между собой
 * до и после провала, и деталь идёт на доработку с этим разговором.
 * @returns {Recording} Запись сборки.
 */
export function defectExchangeRecording(): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    { t: 100, type: "stage_enter", stage: "test" },
    messageAt(1_500, "test", "code"),
    { t: 1_600, type: "stage_fail", stage: "test", reason: "проверки не прошли" },
    messageAt(1_700, "code", "test"),
    { t: 2_000, type: "stage_enter", stage: "code" },
    { t: 3_000, type: "build_end", ok: true },
  ];
  return { ...reworkRecording(), events };
}

/**
 * Запись для тестов с репликой кода проверкам перед другой речью визита: она звучит у станка,
 * а не у места встречи, и обмен остаётся только у реплики после промпта и слов мастера.
 * @returns {Recording} Запись сборки.
 */
export function earlyExchangeRecording(): Recording {
  const events: FactoryEvent[] = [
    { t: 0, type: "build_start" },
    { t: 100, type: "stage_enter", stage: "code" },
    messageAt(500, "code", "test"),
    { t: 600, type: "prompt", goal: "Добавь счётчик", requirements: ["Над цехом"] },
    messageAt(700, "foreman", "code"),
    messageAt(900, "test", "code"),
    { t: 1_000, type: "stage_enter", stage: "test" },
    { t: 2_000, type: "build_end", ok: true },
  ];
  return { ...reworkRecording(), events };
}

/** Записи с речью для тестов времени: с обменом при передаче и без. */
export const SPEECH_RECORDINGS: readonly {
  readonly name: string;
  readonly recording: Recording;
}[] = [
  { name: "с мастером и обменом", recording: chatRecording() },
  { name: "с обменом при возврате с браком", recording: defectExchangeRecording() },
  { name: "с репликой перед другой речью", recording: earlyExchangeRecording() },
];

/** План и темп для тестов: свой для тестов и каждый план цеха в темпе по умолчанию. */
export const PLAYBACK_SETUPS: readonly {
  readonly name: string;
  readonly layout: FactoryLayout;
  readonly pacing: Pacing;
}[] = [
  { name: "линейный", layout: LINE_LAYOUT, pacing: PLAIN_PACING },
  ...FACTORY_LAYOUTS.map((layout) => ({
    name: `${layout.width}×${layout.height}`,
    layout,
    pacing: DEFAULT_PACING,
  })),
];
