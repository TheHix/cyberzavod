// Формат записи сборки. Цех на сайте проигрывает запись по этим событиям,
// поэтому всё, что видно на экране, должно выводиться отсюда.

/** Этапы сборки по порядку: постановка, код, проверки, ревью, выпуск. */
export const STAGES = ["spec", "code", "test", "review", "ship"] as const;

/** Этап сборки — одна из станций цеха. */
export type Stage = (typeof STAGES)[number];

/** Событие записи сборки; `t` — миллисекунды от начала сборки. */
export type FactoryEvent =
  | { t: number; type: "build_start"; title: string }
  | { t: number; type: "prompt"; text: string }
  | { t: number; type: "stage_enter"; stage: Stage }
  | { t: number; type: "stage_fail"; stage: Stage; reason: string }
  | { t: number; type: "usage"; tokens: number }
  | { t: number; type: "build_end"; ok: boolean };

/** Запись сборки: последовательность событий, которую проигрывает цех. */
export interface Recording {
  version: 1;
  id: string;
  title: string;
  events: FactoryEvent[];
}

/** Счётчики сборки, которые показываются над цехом. */
export interface BuildStats {
  durationMs: number;
  tokens: number;
  prompts: number;
  reworks: number;
  ok: boolean;
}

/** Ошибка формата записи: запись пришла извне и не прошла проверку. */
export class RecordingError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStage(value: unknown): value is Stage {
  return (STAGES as readonly unknown[]).includes(value);
}

function parseEvent(raw: unknown, index: number): FactoryEvent {
  const fail = (why: string) => new RecordingError(`событие #${index}: ${why}`);
  if (!isObject(raw)) throw fail("не объект");

  const { t, type } = raw;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0) throw fail("некорректное время t");

  switch (type) {
    case "build_start":
      if (typeof raw.title !== "string") throw fail("нет title");
      return { t, type, title: raw.title };
    case "prompt":
      if (typeof raw.text !== "string") throw fail("нет text");
      return { t, type, text: raw.text };
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
  if (typeof raw.id !== "string" || raw.id === "") throw new RecordingError("нет id");
  if (typeof raw.title !== "string") throw new RecordingError("нет title");
  if (!Array.isArray(raw.events)) throw new RecordingError("нет events");

  const events = raw.events.map(parseEvent);
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

  return { version: 1, id: raw.id, title: raw.title, events };
}

/**
 * Считает счётчики сборки по её записи.
 * @param {Recording} recording Проверенная запись сборки.
 * @returns {BuildStats} Длительность, токены, число промптов и возвратов, итог сборки.
 */
export function summarize(recording: Recording): BuildStats {
  const { events } = recording;
  const stats: BuildStats = {
    durationMs: (events.at(-1)?.t ?? 0) - (events[0]?.t ?? 0),
    tokens: 0,
    prompts: 0,
    reworks: 0,
    ok: false,
  };
  for (const event of events) {
    switch (event.type) {
      case "usage":
        stats.tokens += event.tokens;
        break;
      case "prompt":
        stats.prompts++;
        break;
      case "stage_fail":
        stats.reworks++;
        break;
      case "build_end":
        stats.ok = event.ok;
        break;
      case "build_start":
      case "stage_enter":
        break;
      default:
        // Новый тип события не скомпилируется, пока его не учтут здесь.
        event satisfies never;
    }
  }
  return stats;
}
