import { describe, expect, it } from "vitest";
import { parseRecording, RecordingError, summarize } from "./recording.ts";

// Запись как сырой JSON: тесты портят её как угодно, проверяет parseRecording.
interface RawRecording {
  version: number;
  id: string;
  startedAt: string;
  title: string;
  events: Record<string, unknown>[];
}

function validRecording(): RawRecording {
  return {
    version: 1,
    id: "demo-1",
    startedAt: "2026-10-04T09:52:13.000Z",
    title: "Счётчики над цехом",
    events: [
      { t: 0, type: "build_start" },
      {
        t: 10,
        type: "prompt",
        goal: "Добавь счётчик токенов",
        requirements: ["Показывай его над цехом", "Разбивай число по разрядам"],
        model: "claude-opus-5-5",
      },
      { t: 20, type: "stage_enter", stage: "code" },
      { t: 30, type: "usage", tokens: 1200 },
      { t: 40, type: "stage_enter", stage: "test" },
      { t: 50, type: "stage_fail", stage: "test", reason: "упал тест" },
      { t: 60, type: "stage_enter", stage: "code" },
      { t: 70, type: "usage", tokens: 800 },
      { t: 90, type: "build_end", ok: true },
    ],
  };
}

describe("parseRecording", () => {
  it("принимает корректную запись", () => {
    const raw = validRecording();

    const recording = parseRecording(raw);

    expect(recording.events).toHaveLength(raw.events.length);
  });

  it("отклоняет неизвестный этап", () => {
    const raw = validRecording();
    raw.events[2] = { t: 20, type: "stage_enter", stage: "deploy" };

    const act = () => parseRecording(raw);

    expect(act).toThrow(RecordingError);
  });

  it("не даёт времени идти назад", () => {
    const raw = validRecording();
    raw.events[3] = { t: 5, type: "usage", tokens: 1200 };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/время идёт назад/);
  });

  it("отклоняет промпт без цели", () => {
    const raw = validRecording();
    raw.events[1] = { t: 10, type: "prompt", goal: " ", requirements: [] };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/goal/);
  });

  it("сохраняет модель, получившую промпт", () => {
    const raw = validRecording();

    const recording = parseRecording(raw);

    expect(recording.events[1]).toMatchObject({ model: "claude-opus-5-5" });
  });

  it("принимает промпт без модели", () => {
    const raw = validRecording();
    raw.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: [] };

    const recording = parseRecording(raw);

    expect(recording.events[1]).not.toHaveProperty("model");
  });

  it("отклоняет пустую модель", () => {
    const raw = validRecording();
    raw.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: [], model: "" };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/model/);
  });

  it("отклоняет требование в несколько строк", () => {
    const raw = validRecording();
    raw.events[1] = { t: 10, type: "prompt", goal: "Цель", requirements: ["первое\nвторое"] };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/requirements/);
  });

  it.each(["04.10.2026", "2026-10-04", "2026-02-31T00:00:00.000Z"])(
    "отклоняет время начала «%s»",
    (startedAt) => {
      const raw = { ...validRecording(), startedAt };

      const act = () => parseRecording(raw);

      expect(act).toThrow(/startedAt/);
    },
  );

  it.each(["../demo", "demo/1", ""])("отклоняет id «%s», непригодный для имени файла", (id) => {
    const raw = { ...validRecording(), id };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/id/);
  });

  it.each(["", "  ", "первая строка\nвторая"])("отклоняет заголовок «%s»", (title) => {
    const raw = { ...validRecording(), title };

    const act = () => parseRecording(raw);

    expect(act).toThrow(/title/);
  });

  it("отклоняет запись без build_end", () => {
    const raw = validRecording();
    raw.events.pop();

    const act = () => parseRecording(raw);

    expect(act).toThrow(/build_end/);
  });
});

describe("summarize", () => {
  it("считает длительность, токены, промпты и возвраты", () => {
    const recording = parseRecording(validRecording());

    const stats = summarize(recording);

    expect(stats).toEqual({ durationMs: 90, tokens: 2000, prompts: 1, reworks: 1, ok: true });
  });
});
