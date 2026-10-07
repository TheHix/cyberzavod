import { describe, expect, it } from "vitest";
import { INTERVENTION_REASONS, type BriefInterventionEvent } from "@cyberzavod/core";
import { LOCALES } from "@/shared/i18n/locale.ts";
import { labelOf } from "./label.ts";

function interventionFor(reason: BriefInterventionEvent["reason"]): BriefInterventionEvent {
  return { t: 0, type: "intervention", reason, line: "Одобряю, делай по плану" };
}

describe("labelOf", () => {
  it.each([
    ["question", "ru", "человек · ответ на вопрос"],
    ["plan_review", "ru", "человек · решение по постановке"],
    ["rework_limit", "ru", "человек · вызов после возвратов"],
    ["stop_gate", "ru", "человек · вызов хуком остановки"],
    ["question", "en", "human · answered a question"],
    ["plan_review", "en", "human · plan decision"],
    ["rework_limit", "en", "human · called after reworks"],
    ["stop_gate", "en", "human · called by stop hook"],
  ] as const)("называет причину %s на языке %s: «%s»", (reason, locale, expected) => {
    const intervention = interventionFor(reason);

    const label = labelOf(intervention, locale);

    expect(label).toBe(expected);
  });

  it.each(LOCALES)("знает каждую причину из ядра на языке %s", (locale) => {
    const labels = INTERVENTION_REASONS.map((reason) => labelOf(interventionFor(reason), locale));

    expect(new Set(labels).size).toBe(INTERVENTION_REASONS.length);
  });
});
