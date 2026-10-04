import { describe, expect, it } from "vitest";
import {
  briefOf,
  NO_TALLY,
  parseRecording,
  RecordingError,
  summarize,
  tally,
} from "./recording.ts";

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

function messageEvent(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    t: 25,
    type: "message",
    from: "foreman",
    to: "code",
    line: "Сделай счётчик",
    text: "Сделай счётчик токенов.\n\nПоказывай его над цехом.",
    ...patch,
  };
}

describe("parseRecording: реплики", () => {
  it("принимает реплику мастера станции, станции мастеру и станции станции", () => {
    const raw = validRecording();
    raw.events.splice(
      3,
      0,
      messageEvent(),
      messageEvent({ from: "code", to: "foreman" }),
      messageEvent({ from: "code", to: "test" }),
    );

    const recording = parseRecording(raw);

    expect(recording.events.filter((event) => event.type === "message")).toHaveLength(3);
  });

  it.each([
    ["дирижёр говорящий", { from: "conductor" }, /говорящий/],
    ["человек говорящий", { from: "human" }, /говорящий/],
    ["неизвестный говорящий", { from: "deploy" }, /говорящий/],
    ["дирижёр адресат", { to: "conductor" }, /адресат/],
    ["человек адресат", { to: "human" }, /адресат/],
    ["неизвестный адресат", { to: "deploy" }, /адресат/],
    ["рабочий говорит сам с собой", { from: "code", to: "code" }, /сам с собой/],
    ["мастер говорит сам с собой", { from: "foreman", to: "foreman" }, /сам с собой/],
    ["многострочная строка", { line: "раз\nдва" }, /line/],
    ["пустая строка", { line: "  " }, /line/],
    ["пустой текст", { text: " \n " }, /text/],
    ["текст не строка", { text: 5 }, /text/],
  ])("отклоняет реплику: %s", (_name, patch, message) => {
    const raw = validRecording();
    raw.events.splice(3, 0, messageEvent(patch));

    const act = () => parseRecording(raw);

    expect(act).toThrow(message);
  });

  it("сохраняет переводы строк в полном тексте", () => {
    const raw = validRecording();
    raw.events.splice(3, 0, messageEvent());

    const recording = parseRecording(raw);

    expect(recording.events[3]).toMatchObject({ text: expect.stringContaining("\n\n") });
  });
});

describe("briefOf", () => {
  it("убирает полный текст у реплик и не трогает остальное", () => {
    const raw = validRecording();
    raw.events.splice(3, 0, messageEvent());
    const recording = parseRecording(raw);

    const brief = briefOf(recording);

    expect(brief.events).toEqual([
      ...recording.events.slice(0, 3),
      { t: 25, type: "message", from: "foreman", to: "code", line: "Сделай счётчик" },
      ...recording.events.slice(4),
    ]);
  });
});

describe("tally", () => {
  it("не меняет счётчики на реплике", () => {
    const event = {
      t: 1,
      type: "message",
      from: "ship",
      to: "foreman",
      line: "Готово",
    } as const;

    const counts = tally(NO_TALLY, event);

    expect(counts).toEqual(NO_TALLY);
  });
});
