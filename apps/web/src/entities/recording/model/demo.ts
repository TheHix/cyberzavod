import { parseRecording, type Recording } from "@cyberzavod/core";

/** Учебная запись, пока настоящих сборок нет. Проходит ту же проверку, что и реальные. */
export const demoRecording: Recording = parseRecording({
  version: 1,
  id: "demo",
  title: "Счётчики над цехом",
  events: [
    { t: 0, type: "build_start", title: "Счётчики над цехом" },
    { t: 1_000, type: "prompt", text: "Покажи над цехом время, токены и число возвратов" },
    { t: 4_000, type: "stage_enter", stage: "spec" },
    { t: 20_000, type: "stage_enter", stage: "code" },
    { t: 80_000, type: "usage", tokens: 18_400 },
    { t: 85_000, type: "stage_enter", stage: "test" },
    { t: 95_000, type: "stage_fail", stage: "test", reason: "не учтена пустая запись" },
    { t: 96_000, type: "stage_enter", stage: "code" },
    { t: 120_000, type: "usage", tokens: 6_200 },
    { t: 125_000, type: "stage_enter", stage: "review" },
    { t: 140_000, type: "stage_enter", stage: "ship" },
    { t: 142_000, type: "build_end", ok: true },
  ],
});
