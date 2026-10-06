import { describe, expect, it } from "vitest";
import { buildScript, type FactoryScript, type Recording } from "@cyberzavod/core";
import { speechAt, speechStart, speechTimeline } from "./speech-timeline.ts";

// Промпты и реплики вперемешку: порядок в записи — реплика, промпт, реплика.
function validScript(): FactoryScript {
  const recording: Recording = {
    version: 2,
    id: "test",
    project: "test",
    factory: "0.0.0",
    startedAt: "2026-10-04T00:00:00.000Z",
    title: "Тест",
    events: [
      { t: 0, type: "build_start" },
      {
        t: 60_000,
        type: "message",
        from: "foreman",
        to: "spec",
        line: "Сделай счётчик",
        text: "Сделай счётчик токенов.",
      },
      { t: 90_000, type: "prompt", goal: "Добавь счётчик", requirements: [] },
      { t: 120_000, type: "stage_enter", stage: "code" },
      {
        t: 180_000,
        type: "message",
        from: "code",
        to: "test",
        line: "Держи, счётчик готов",
        text: "Держи, счётчик токенов готов.",
      },
      { t: 240_000, type: "build_end", ok: true },
    ],
  };
  return buildScript(recording);
}

describe("speechTimeline", () => {
  it("собирает промпты и реплики в один список по началу", () => {
    const script = validScript();

    const timeline = speechTimeline(script);

    expect(timeline.map((mark) => mark.speech)).toEqual([
      { kind: "message", index: 0 },
      { kind: "prompt", index: 0 },
      { kind: "message", index: 1 },
    ]);
    expect(timeline.map((mark) => mark.start)).toEqual(
      [...timeline.map((mark) => mark.start)].sort((earlier, later) => earlier - later),
    );
  });

  it("берёт начало отметки у пузыря сценария", () => {
    const script = validScript();

    const timeline = speechTimeline(script);

    expect(timeline.find((mark) => mark.speech.kind === "prompt")?.start).toBe(
      script.prompts[0]?.start,
    );
  });
});

describe("speechAt", () => {
  it("даёт null до первой речи", () => {
    const timeline = speechTimeline(validScript());
    const first = timeline[0]?.start ?? 0;

    const speech = speechAt(timeline, first - 1);

    expect(speech).toBeNull();
  });

  it("даёт речь в момент её начала", () => {
    const timeline = speechTimeline(validScript());
    const second = timeline[1];

    const speech = speechAt(timeline, second?.start ?? 0);

    expect(speech).toBe(second?.speech);
  });

  it("держит последнюю начавшуюся речь между пузырями", () => {
    const script = validScript();
    const timeline = speechTimeline(script);
    const afterBubble = (script.prompts[0]?.end ?? 0) + 1;

    const speech = speechAt(timeline, afterBubble);

    expect(speech).toBe(timeline[1]?.speech);
  });

  it("отдаёт ту же ссылку, пока речь не сменилась", () => {
    const timeline = speechTimeline(validScript());
    const start = timeline[0]?.start ?? 0;

    const atStart = speechAt(timeline, start);
    const later = speechAt(timeline, start + 1);

    expect(later).toBe(atStart);
  });
});

describe("speechStart", () => {
  it("даёт начало пузыря речи", () => {
    const script = validScript();
    const timeline = speechTimeline(script);

    const start = speechStart(timeline, { kind: "message", index: 1 });

    expect(start).toBe(script.messages[1]?.start);
  });

  it("различает промпт и реплику с одним номером", () => {
    const script = validScript();
    const timeline = speechTimeline(script);

    const start = speechStart(timeline, { kind: "prompt", index: 0 });

    expect(start).toBe(script.prompts[0]?.start);
  });

  it("не находит неизвестную речь", () => {
    const timeline = speechTimeline(validScript());

    const start = speechStart(timeline, { kind: "message", index: 7 });

    expect(start).toBeUndefined();
  });
});
