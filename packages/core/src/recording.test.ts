import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecording, summarize, RecordingError } from "./recording.ts";

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

test("корректная запись разбирается и считается", () => {
  // Arrange
  const raw = validRecording();

  // Act
  const stats = summarize(parseRecording(raw));

  // Assert
  assert.deepEqual(stats, { durationMs: 90, tokens: 2000, prompts: 1, reworks: 1, ok: true });
});

test("неизвестный этап отклоняется", () => {
  // Arrange
  const raw = validRecording();
  raw.events[2] = { t: 20, type: "stage_enter", stage: "deploy" };

  // Act
  const act = () => parseRecording(raw);

  // Assert
  assert.throws(act, RecordingError);
});

test("время не может идти назад", () => {
  // Arrange
  const raw = validRecording();
  raw.events[3]!.t = 5;

  // Act
  const act = () => parseRecording(raw);

  // Assert
  assert.throws(act, /время идёт назад/);
});

test("запись без build_end отклоняется", () => {
  // Arrange
  const raw = validRecording();
  raw.events.pop();

  // Act
  const act = () => parseRecording(raw);

  // Assert
  assert.throws(act, /build_end/);
});
