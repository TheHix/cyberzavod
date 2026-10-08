import { describe, expect, it } from "vitest";
import type { RecordingTotals } from "@/entities/recording";
import { projectTotalsOf } from "./totals-view.ts";

function projectTotals(): RecordingTotals {
  return {
    builds: 7,
    durationMs: 9_420_000,
    tokens: 2_526_012,
    prompts: 8,
    reworks: 3,
    buildsWithoutReworks: 4,
    interventions: 1,
  };
}

describe("projectTotalsOf", () => {
  it("показывает сборки, время всего и в среднем на сборку и токены", () => {
    const totals = projectTotals();

    const items = projectTotalsOf(totals, "ru");

    expect(items.slice(0, 4)).toEqual([
      { label: "Сборки", value: "7" },
      { label: "Общее время", value: "2 ч 37 мин" },
      { label: "В среднем на сборку", value: "22 мин 26 с" },
      { label: "Токены всего", value: "2 526 012" },
    ]);
  });

  it("поясняет возвраты числом сборок, которые обошлись без них", () => {
    const totals = projectTotals();

    const items = projectTotalsOf(totals, "ru");

    expect(items[4]).toEqual({
      label: "Возвраты",
      value: "3",
      detail: "без возвратов 4 из 7",
    });
  });

  it("складывает участие человека из промптов и вмешательств", () => {
    const totals = projectTotals();

    const items = projectTotalsOf(totals, "en");

    expect(items[5]).toEqual({
      label: "Human input",
      value: "9",
      detail: "8 prompts · 1 intervention",
    });
  });

  it("у проекта без сборок не делит на ноль", () => {
    const totals = { ...projectTotals(), builds: 0, durationMs: 0 };

    const items = projectTotalsOf(totals, "en");

    expect(items[2]).toEqual({ label: "Per build on average", value: "0 s" });
  });
});
