import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecording, summarize, RecordingError } from "./recording.ts";

const sample = {
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

test("корректная запись разбирается и считается", () => {
  const stats = summarize(parseRecording(sample));
  assert.deepEqual(stats, { durationMs: 90, tokens: 2000, prompts: 1, reworks: 1, ok: true });
});

test("неизвестный этап отклоняется", () => {
  const bad = structuredClone(sample);
  bad.events[2] = { t: 20, type: "stage_enter", stage: "deploy" };
  assert.throws(() => parseRecording(bad), RecordingError);
});

test("время не может идти назад", () => {
  const bad = structuredClone(sample);
  bad.events[3]!.t = 5;
  assert.throws(() => parseRecording(bad), /время идёт назад/);
});

test("запись без build_end отклоняется", () => {
  const bad = structuredClone(sample);
  bad.events.pop();
  assert.throws(() => parseRecording(bad), /build_end/);
});
