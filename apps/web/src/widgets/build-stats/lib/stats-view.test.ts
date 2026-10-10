import { describe, expect, it } from "vitest";
import type { BuildStats } from "@/entities/stats";
import { statsViewOf } from "./stats-view.ts";

function emptyStats(): BuildStats {
  return {
    recordings: 0,
    authors: 0,
    tokens: 0,
    withoutReworks: 0,
    returns: [],
    interventions: [],
    outcomes: { ok: 0, failed: 0 },
  };
}

function filledStats(): BuildStats {
  return {
    recordings: 12,
    authors: 3,
    tokens: 4_500_000,
    withoutReworks: 5,
    returns: [
      { key: "verification", count: 2 },
      { key: "review", count: 7 },
      { key: "deploy", count: 1 },
    ],
    interventions: [{ key: "plan_review", count: 9 }],
    outcomes: { ok: 10, failed: 2 },
  };
}

describe("statsViewOf", () => {
  it("показывает заглушку, пока в открытых галереях нет сборок", () => {
    const view = statsViewOf(emptyStats(), "ru");

    expect(view).toEqual({ kind: "empty" });
  });

  it("считает возвраты и вмешательства в числах", () => {
    const view = statsViewOf(filledStats(), "en");

    expect(view.kind === "filled" && view.totals).toEqual([
      { label: "Builds", value: "12" },
      { label: "Authors", value: "3" },
      { label: "Tokens", value: "4,500,000" },
      { label: "First try", value: "42%", detail: "5 of 12" },
      { label: "Reworks", value: "10" },
      { label: "Interventions", value: "9" },
    ]);
  });

  it("подписывает возвраты названиями этапов, частые сверху, незнакомый этап — как есть", () => {
    const view = statsViewOf(filledStats(), "ru");

    expect(view.kind === "filled" && view.returns).toEqual([
      { label: "Ревью", value: 7, valueText: "7" },
      { label: "Проверки", value: 2, valueText: "2" },
      { label: "deploy", value: 1, valueText: "1" },
    ]);
  });

  it("подписывает вмешательства причинами", () => {
    const view = statsViewOf(filledStats(), "en");

    expect(view.kind === "filled" && view.interventions).toEqual([
      { label: "plan decision", value: 9, valueText: "9" },
    ]);
  });

  it("показывает исходы сборок", () => {
    const view = statsViewOf(filledStats(), "ru");

    expect(view.kind === "filled" && view.outcomes).toEqual([
      { label: "успешно", value: 10, valueText: "10" },
      { label: "с ошибкой", value: 2, valueText: "2" },
    ]);
  });
});
