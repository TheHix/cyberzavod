// Формат записи сборки. Цех на сайте проигрывает запись по этим событиям,
// поэтому всё, что видно на экране, должно выводиться отсюда.

import { isLine, isObject } from "./guards.ts";

/** Этапы сборки по порядку: постановка, код, проверки, ревью, выпуск. */
export const STAGES = ["spec", "code", "test", "review", "ship"] as const;

/** Этап сборки — одна из станций цеха. */
export type Stage = (typeof STAGES)[number];

/**
 * Промпт человека в чистовом виде: главное указание одной строкой и уточнения списком.
 * Как промпт был набран, в запись не попадает — только то, что человек просил.
 */
export interface PromptEvent {
  t: number;
  type: "prompt";
  goal: string;
  requirements: string[];
  /** Модель, которая получила промпт, — id вроде `claude-opus-5-5`; нет, если неизвестна. */
  model?: string;
}

/** Мастер цеха — человек-программист: раздаёт задачи и принимает итог. */
export const FOREMAN = "foreman";

/** Участник разговора в цехе: рабочий станции или мастер. */
export type Speaker = Stage | typeof FOREMAN;

/** Реплика: строка над говорящим в цехе и полный текст для журнала. */
export interface MessageEvent {
  t: number;
  type: "message";
  from: Speaker;
  /** Кому адресована реплика; не совпадает с `from`. */
  to: Speaker;
  /** Одна строка над говорящим в цехе. */
  line: string;
  /** Полный текст: абзацы через пустую строку, без разметки. */
  text: string;
}

/** Событие записи сборки; `t` — миллисекунды от начала сборки. */
export type FactoryEvent =
  | { t: number; type: "build_start" }
  | PromptEvent
  | MessageEvent
  | { t: number; type: "stage_enter"; stage: Stage }
  | { t: number; type: "stage_fail"; stage: Stage; reason: string }
  | { t: number; type: "usage"; tokens: number }
  | { t: number; type: "build_end"; ok: boolean };

/** Запись сборки: последовательность событий, которую проигрывает цех. */
export interface Recording {
  version: 2;
  /** Идентификатор записи: он же имя файла и часть адреса страницы. */
  id: string;
  /** Идентификатор проекта, который собирали: те же правила, что у `id` записи. */
  project: string;
  /** Версия завода на момент сборки одной строкой, например `0.1.0`. */
  factory: string;
  /** Время начала сборки в ISO 8601 по UTC, как у `Date.prototype.toISOString`. */
  startedAt: string;
  title: string;
  events: FactoryEvent[];
}

/** Реплика без полного текста: цеху нужна только строка над говорящим. */
export type BriefMessageEvent = Omit<MessageEvent, "text">;

/** Событие записи, как его видит цех: у реплик нет полного текста. */
export type BriefFactoryEvent = Exclude<FactoryEvent, MessageEvent> | BriefMessageEvent;

/** Запись без полных текстов реплик: её получает цех, а полный текст остаётся в журнале. */
export interface BriefRecording extends Omit<Recording, "events"> {
  events: BriefFactoryEvent[];
}

/** Счётчики сборки на какой-то момент: токены, промпты человека и возвраты на доработку. */
export interface Tally {
  tokens: number;
  prompts: number;
  reworks: number;
}

/** Счётчики сборки, которые показываются над цехом. */
export interface BuildStats extends Tally {
  durationMs: number;
  ok: boolean;
}

/** Счётчики до первого события. */
export const NO_TALLY: Tally = { tokens: 0, prompts: 0, reworks: 0 };

/** Ошибка формата записи: запись пришла извне и не прошла проверку. */
export class RecordingError extends Error {}

function isStage(value: unknown): value is Stage {
  return (STAGES as readonly unknown[]).includes(value);
}

/**
 * Проверяет, что значение — участник разговора в цехе.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is Speaker} true, если это этап или мастер.
 */
export function isSpeaker(value: unknown): value is Speaker {
  return value === FOREMAN || isStage(value);
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLine);
}

// id уходит в имя файла и в адрес страницы: только буквы, цифры, `_` и `-`.
const ID_PATTERN = /^[\w-]+$/;

/**
 * Проверяет, что значение годится в идентификаторы записи и проекта.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если это строка из букв, цифр, «_» и «-».
 */
export function isRecordingId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/**
 * Проверяет, что значение — версия завода: непустая строка без переводов строки.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если значение можно показать версией в одну строку.
 */
export function isFactoryVersion(value: unknown): value is string {
  return isLine(value);
}

// Строгое сравнение с toISOString отсекает и другие форматы, и несуществующие дни вроде
// 31 февраля, которые Date.parse молча переносит на март.
function isInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

type Fail = (why: string) => RecordingError;

function parsePrompt(raw: Record<string, unknown>, t: number, fail: Fail): PromptEvent {
  const { goal, requirements, model } = raw;
  if (!isLine(goal)) throw fail("goal должен быть непустой строкой без переводов строки");
  if (!isLines(requirements)) {
    throw fail("requirements должны быть списком непустых строк без переводов строки");
  }
  const prompt: PromptEvent = { t, type: "prompt", goal, requirements: [...requirements] };
  if (model === undefined) return prompt;
  if (!isLine(model)) throw fail("model должна быть непустой строкой без переводов строки");
  return { ...prompt, model };
}

function parseMessage(raw: Record<string, unknown>, t: number, fail: Fail): MessageEvent {
  const { from, to, line, text } = raw;
  if (!isSpeaker(from)) throw fail(`неизвестный говорящий ${String(from)}`);
  if (!isSpeaker(to)) throw fail(`неизвестный адресат ${String(to)}`);
  if (from === to) throw fail(`${from} не может говорить сам с собой`);
  if (!isLine(line)) throw fail("line должна быть непустой строкой без переводов строки");
  if (typeof text !== "string" || text.trim() === "") {
    throw fail("text должен быть непустой строкой");
  }
  return { t, type: "message", from, to, line, text };
}

/**
 * Проверяет одно событие записи, пришедшее извне.
 * @param {unknown} raw Разобранный JSON события.
 * @param {number} index Номер события в записи — для сообщения об ошибке.
 * @returns {FactoryEvent} Проверенное событие.
 * @throws {RecordingError} Если событие не соответствует формату.
 */
export function parseFactoryEvent(raw: unknown, index: number): FactoryEvent {
  const fail: Fail = (why) => new RecordingError(`событие #${index}: ${why}`);
  if (!isObject(raw)) throw fail("не объект");

  const { t, type } = raw;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0) throw fail("некорректное время t");

  switch (type) {
    case "build_start":
      return { t, type };
    case "prompt":
      return parsePrompt(raw, t, fail);
    case "message":
      return parseMessage(raw, t, fail);
    case "stage_enter":
      if (!isStage(raw.stage)) throw fail(`неизвестный этап ${String(raw.stage)}`);
      return { t, type, stage: raw.stage };
    case "stage_fail":
      if (!isStage(raw.stage)) throw fail(`неизвестный этап ${String(raw.stage)}`);
      if (typeof raw.reason !== "string") throw fail("нет reason");
      return { t, type, stage: raw.stage, reason: raw.reason };
    case "usage":
      if (typeof raw.tokens !== "number" || raw.tokens < 0) throw fail("некорректное tokens");
      return { t, type, tokens: raw.tokens };
    case "build_end":
      if (typeof raw.ok !== "boolean") throw fail("нет ok");
      return { t, type, ok: raw.ok };
    default:
      throw fail(`неизвестный тип ${String(type)}`);
  }
}

/**
 * Проверяет запись, пришедшую извне, и возвращает её типизированной.
 * @param {unknown} raw Разобранный JSON записи.
 * @returns {Recording} Проверенная запись.
 * @throws {RecordingError} Если запись не соответствует формату.
 */
export function parseRecording(raw: unknown): Recording {
  if (!isObject(raw)) throw new RecordingError("запись должна быть объектом");
  if (raw.version !== 2) throw new RecordingError(`неподдерживаемая версия ${String(raw.version)}`);
  if (!isRecordingId(raw.id)) {
    throw new RecordingError("id должен состоять из букв, цифр, «_» и «-»");
  }
  if (!isRecordingId(raw.project)) {
    throw new RecordingError("project должен состоять из букв, цифр, «_» и «-»");
  }
  if (!isFactoryVersion(raw.factory)) {
    throw new RecordingError("factory должна быть непустой строкой без переводов строки");
  }
  if (!isInstant(raw.startedAt)) {
    throw new RecordingError("startedAt должно быть временем ISO 8601 по UTC, как у toISOString");
  }
  if (!isLine(raw.title)) {
    throw new RecordingError("title должен быть непустой строкой без переводов строки");
  }
  if (!Array.isArray(raw.events)) throw new RecordingError("нет events");

  const events = raw.events.map(parseFactoryEvent);
  if (events[0]?.type !== "build_start") {
    throw new RecordingError("запись должна начинаться с build_start");
  }
  if (events.at(-1)?.type !== "build_end") {
    throw new RecordingError("запись должна заканчиваться build_end");
  }
  let prevT = 0;
  events.forEach((event, i) => {
    if (event.t < prevT) throw new RecordingError(`событие #${i}: время идёт назад`);
    prevT = event.t;
  });

  return {
    version: 2,
    id: raw.id,
    project: raw.project,
    factory: raw.factory,
    startedAt: raw.startedAt,
    title: raw.title,
    events,
  };
}

/**
 * Добавляет событие записи к счётчикам сборки.
 * @param {Tally} counts Счётчики до события.
 * @param {BriefFactoryEvent} event Событие записи.
 * @returns {Tally} Счётчики после события.
 */
export function tally(counts: Tally, event: BriefFactoryEvent): Tally {
  switch (event.type) {
    case "usage":
      return { ...counts, tokens: counts.tokens + event.tokens };
    case "prompt":
      return { ...counts, prompts: counts.prompts + 1 };
    case "stage_fail":
      return { ...counts, reworks: counts.reworks + 1 };
    case "build_start":
    case "stage_enter":
    case "message":
    case "build_end":
      return counts;
    default:
      // Новый тип события не скомпилируется, пока его не учтут здесь.
      return event satisfies never;
  }
}

/**
 * Итог сборки: удалась ли она по последнему событию записи.
 * @param {BriefRecording} recording Проверенная запись сборки.
 * @returns {boolean} true, если запись кончается удачным build_end.
 */
export function succeeded(recording: BriefRecording): boolean {
  const last = recording.events.at(-1);
  return last?.type === "build_end" && last.ok;
}

/**
 * Считает счётчики сборки по её записи.
 * @param {BriefRecording} recording Проверенная запись сборки.
 * @returns {BuildStats} Длительность, токены, число промптов и возвратов, итог сборки.
 */
export function summarize(recording: BriefRecording): BuildStats {
  const { events } = recording;
  return {
    durationMs: (events.at(-1)?.t ?? 0) - (events[0]?.t ?? 0),
    ...events.reduce(tally, NO_TALLY),
    ok: succeeded(recording),
  };
}

/**
 * Убирает у реплики полный текст.
 * @param {BriefMessageEvent} event Реплика; на деле может нести и `text`.
 * @returns {BriefMessageEvent} Новая реплика только с полями, которые нужны цеху.
 */
export function briefMessage(event: BriefMessageEvent): BriefMessageEvent {
  const { t, type, from, to, line } = event;
  return { t, type, from, to, line };
}

/**
 * Убирает у реплик полный текст: цеху он не нужен, а в страницу с цехом попадать не должен.
 * @param {Recording} recording Полная запись сборки.
 * @returns {BriefRecording} Та же запись, у реплик которой нет `text`.
 */
export function briefOf(recording: Recording): BriefRecording {
  const events = recording.events.map((event): BriefFactoryEvent => {
    return event.type === "message" ? briefMessage(event) : event;
  });
  return { ...recording, events };
}
