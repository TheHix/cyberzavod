import { describe, expect, it } from "vitest";
import { parseRecording, RecordingError, summarize } from "./recording.ts";

function validRecording() {
  return {
    version: 1,
    id: "demo-1",
    title: "Счётчики над цехом",
    events: [
      { t: 0, type: "build_start", title: "Счётчики над цехом" },
      { t: 10, type: "prompt", text: "Добавь счётчик токенов" },
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
