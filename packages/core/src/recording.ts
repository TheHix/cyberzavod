// Формат записи сборки. Цех на сайте проигрывает запись по этим событиям,
// поэтому всё, что видно на экране, должно выводиться отсюда.

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

/** Событие записи сборки; `t` — миллисекунды от начала сборки. */
export type FactoryEvent =
  | { t: number; type: "build_start" }
  | PromptEvent
  | { t: number; type: "stage_enter"; stage: Stage }
  | { t: number; type: "stage_fail"; stage: Stage; reason: string }
  | { t: number; type: "usage"; tokens: number }
  | { t: number; type: "build_end"; ok: boolean };

/** Запись сборки: последовательность событий, которую проигрывает цех. */
export interface Recording {
  version: 1;
  /** Идентификатор записи: он же имя файла и часть адреса страницы. */
  id: string;
  /** Время начала сборки в ISO 8601 по UTC, как у `Date.prototype.toISOString`. */
  startedAt: string;
  title: string;
  events: FactoryEvent[];
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStage(value: unknown): value is Stage {
  return (STAGES as readonly unknown[]).includes(value);
}

// Тексты записи показываются в одну строку: в заголовке, в карточке промпта.
function isLine(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/[\r\n]/.test(value);
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLine);
}

// id уходит в имя файла и в адрес страницы: только буквы, цифры, `_` и `-`.
const ID_PATTERN = /^[\w-]+$/;

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
  if (raw.version !== 1) throw new RecordingError(`неподдерживаемая версия ${String(raw.version)}`);
  if (typeof raw.id !== "string" || !ID_PATTERN.test(raw.id)) {
    throw new RecordingError("id должен состоять из букв, цифр, «_» и «-»");
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

  return { version: 1, id: raw.id, startedAt: raw.startedAt, title: raw.title, events };
}

/**
 * Добавляет событие записи к счётчикам сборки.
 * @param {Tally} counts Счётчики до события.
 * @param {FactoryEvent} event Событие записи.
 * @returns {Tally} Счётчики после события.
 */
export function tally(counts: Tally, event: FactoryEvent): Tally {
  switch (event.type) {
    case "usage":
      return { ...counts, tokens: counts.tokens + event.tokens };
    case "prompt":
      return { ...counts, prompts: counts.prompts + 1 };
    case "stage_fail":
      return { ...counts, reworks: counts.reworks + 1 };
    case "build_start":
    case "stage_enter":
    case "build_end":
      return counts;
    default:
      // Новый тип события не скомпилируется, пока его не учтут здесь.
      return event satisfies never;
  }
}

/**
 * Итог сборки: удалась ли она по последнему событию записи.
 * @param {Recording} recording Проверенная запись сборки.
 * @returns {boolean} true, если запись кончается удачным build_end.
 */
export function succeeded(recording: Recording): boolean {
  const last = recording.events.at(-1);
  return last?.type === "build_end" && last.ok;
}

/**
 * Считает счётчики сборки по её записи.
 * @param {Recording} recording Проверенная запись сборки.
 * @returns {BuildStats} Длительность, токены, число промптов и возвратов, итог сборки.
 */
export function summarize(recording: Recording): BuildStats {
  const { events } = recording;
  return {
    durationMs: (events.at(-1)?.t ?? 0) - (events[0]?.t ?? 0),
    ...events.reduce(tally, NO_TALLY),
    ok: succeeded(recording),
  };
}
