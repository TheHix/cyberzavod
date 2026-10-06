import { describe, expect, it } from "vitest";
import { INTERVENTION_REASONS, type BriefInterventionEvent } from "@cyberzavod/core";
import { labelOf } from "./label.ts";

function interventionFor(reason: BriefInterventionEvent["reason"]): BriefInterventionEvent {
  return { t: 0, type: "intervention", reason, line: "Одобряю, делай по плану" };
}

describe("labelOf", () => {
  it.each([
    ["question", "человек · ответ на вопрос"],
    ["spec_review", "человек · решение по постановке"],
    ["rework_limit", "человек · вызов после возвратов"],
    ["stop_gate", "человек · вызов хуком остановки"],
  ] as const)("называет причину %s: «%s»", (reason, expected) => {
    const intervention = interventionFor(reason);

    const label = labelOf(intervention);

    expect(label).toBe(expected);
  });

  it("знает каждую причину из ядра", () => {
    const labels = INTERVENTION_REASONS.map((reason) => labelOf(interventionFor(reason)));

    expect(new Set(labels).size).toBe(INTERVENTION_REASONS.length);
  });
});
