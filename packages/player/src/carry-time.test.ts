import { describe, expect, it } from "vitest";
import { carryTime, ScriptMismatchError } from "./carry-time.ts";
import { PORTRAIT_LAYOUT, WIDE_LAYOUT } from "./layout.ts";
import { sceneAt } from "./scene.ts";
import { chatRecording, reworkRecording, withEvents } from "./script.fixtures.ts";
import { buildScript, DEFAULT_PACING } from "./script.ts";

// Смещение после последней отметки, мс: внутри финала, который длится `finaleMs`.
const AFTER_LAST_MARK_MS = DEFAULT_PACING.finaleMs / 2;
const BEFORE_FIRST_MARK_MS = 500;

function scriptsOfChat() {
  const recording = chatRecording();
  return {
    wide: buildScript(recording, WIDE_LAYOUT, DEFAULT_PACING),
    portrait: buildScript(recording, PORTRAIT_LAYOUT, DEFAULT_PACING),
  };
}

describe("carryTime", () => {
  it("сохраняет время записи на отметках", () => {
    const { wide, portrait } = scriptsOfChat();

    const carried = wide.marks.map((mark) => {
      const time = carryTime(wide, portrait, mark.at);
      return [sceneAt(portrait, time).recordingTime, sceneAt(wide, mark.at).recordingTime];
    });

    for (const [actual, expected] of carried) expect(actual).toBeCloseTo(expected ?? 0, 6);
  });

  it("сохраняет время записи между отметками", () => {
    const { wide, portrait } = scriptsOfChat();

    const carried = wide.marks.slice(1).map((mark, index) => {
      const previous = wide.marks[index]?.at ?? 0;
      const time = (previous + mark.at) / 2;
      return [
        sceneAt(portrait, carryTime(wide, portrait, time)).recordingTime,
        sceneAt(wide, time).recordingTime,
      ];
    });

    for (const [actual, expected] of carried) expect(actual).toBeCloseTo(expected ?? 0, 6);
  });

  it("сохраняет смещение до первой отметки с прижатием к началу сцены", () => {
    const { wide, portrait } = scriptsOfChat();
    const first = wide.marks[0]?.at ?? 0;

    const time = carryTime(wide, portrait, first - BEFORE_FIRST_MARK_MS);

    expect(time).toBe(Math.max(0, (portrait.marks[0]?.at ?? 0) - BEFORE_FIRST_MARK_MS));
  });

  it("сохраняет смещение после последней отметки", () => {
    const { wide, portrait } = scriptsOfChat();
    const last = wide.marks.at(-1)?.at ?? 0;
    const portraitLast = portrait.marks.at(-1)?.at ?? 0;

    const time = carryTime(wide, portrait, last + AFTER_LAST_MARK_MS);

    expect(time).toBeCloseTo(portraitLast + AFTER_LAST_MARK_MS, 6);
  });

  it("прижимает перенесённый момент к длительности целевого сценария", () => {
    const { wide, portrait } = scriptsOfChat();

    const time = carryTime(wide, portrait, wide.duration + 1_000_000);

    expect(time).toBe(portrait.duration);
  });

  it("отклоняет сценарии разных записей", () => {
    const rework = buildScript(reworkRecording(), WIDE_LAYOUT, DEFAULT_PACING);
    const chat = buildScript(chatRecording(), PORTRAIT_LAYOUT, DEFAULT_PACING);

    const act = () => carryTime(rework, chat, 1_000);

    expect(act).toThrow(ScriptMismatchError);
  });

  it("отклоняет сценарии с тем же числом отметок, но другим временем записи", () => {
    const original = reworkRecording();
    const shifted = withEvents(
      original,
      original.data.events.map((event) => ({ ...event, t: event.t + 1 })),
    );
    const source = buildScript(original, WIDE_LAYOUT, DEFAULT_PACING);
    const target = buildScript(shifted, PORTRAIT_LAYOUT, DEFAULT_PACING);

    const act = () => carryTime(source, target, 1_000);

    expect(act).toThrow(ScriptMismatchError);
  });
});
