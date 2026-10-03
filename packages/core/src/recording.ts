// Формат записи сборки. Цех на сайте проигрывает запись по этим событиям,
// поэтому всё, что видно на экране, должно выводиться отсюда.

export const STAGES = ["spec", "code", "test", "review", "ship"] as const;
export type Stage = (typeof STAGES)[number];

// t — миллисекунды от начала сборки.
export type FactoryEvent =
  | { t: number; type: "build_start"; title: string }
  | { t: number; type: "prompt"; text: string }
  | { t: number; type: "stage_enter"; stage: Stage }
  | { t: number; type: "stage_fail"; stage: Stage; reason: string }
  | { t: number; type: "usage"; tokens: number }
  | { t: number; type: "build_end"; ok: boolean };

export interface Recording {
  version: 1;
  id: string;
  title: string;
  events: FactoryEvent[];
}

export interface BuildStats {
  durationMs: number;
  tokens: number;
  prompts: number;
  reworks: number;
  ok: boolean;
}

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

// Проверяет запись, пришедшую извне (JSON-файл), и возвращает типизированную.
export function parseRecording(raw: unknown): Recording {
  if (!isObject(raw)) throw new RecordingError("запись должна быть объектом");
  if (raw.version !== 1) throw new RecordingError(`неподдерживаемая версия ${String(raw.version)}`);
  if (typeof raw.id !== "string" || raw.id === "") throw new RecordingError("нет id");
  if (typeof raw.title !== "string") throw new RecordingError("нет title");
  if (!Array.isArray(raw.events)) throw new RecordingError("нет events");

  const events = raw.events.map(parseEvent);
  if (events[0]?.type !== "build_start") throw new RecordingError("запись должна начинаться с build_start");
  if (events.at(-1)?.type !== "build_end") throw new RecordingError("запись должна заканчиваться build_end");
  let prevT = 0;
  events.forEach((event, i) => {
    if (event.t < prevT) throw new RecordingError(`событие #${i}: время идёт назад`);
    prevT = event.t;
  });

  return { version: 1, id: raw.id, title: raw.title, events };
}

// Счётчики сборки, которые показываются над цехом.
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
    if (event.type === "usage") stats.tokens += event.tokens;
    else if (event.type === "prompt") stats.prompts++;
    else if (event.type === "stage_fail") stats.reworks++;
    else if (event.type === "build_end") stats.ok = event.ok;
  }
  return stats;
}
