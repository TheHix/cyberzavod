import { describe, expect, it } from "vitest";
import type { RecordingTotals } from "@/entities/recording";
import { referenceChartsOf, type ReferenceProject } from "./reference-view.ts";

function totalsWith(changes: Partial<RecordingTotals>): RecordingTotals {
  return {
    builds: 7,
    durationMs: 9_420_000,
    tokens: 2_526_012,
    prompts: 8,
    reworks: 3,
    buildsWithoutReworks: 4,
    interventions: 1,
    ...changes,
  };
}

function referenceProjects(): ReferenceProject[] {
  return [
    { name: "Split the Bill", totals: totalsWith({}) },
    {
      name: "dupes",
      totals: totalsWith({
        builds: 3,
        durationMs: 4_655_426,
        tokens: 1_804_298,
        prompts: 1,
        reworks: 4,
        interventions: 0,
      }),
    },
  ];
}

describe("referenceChartsOf", () => {
  it("строит по диаграмме на метрику в порядке таблицы", () => {
    const charts = referenceChartsOf(referenceProjects(), "en");

    expect(charts.map((chart) => chart.heading)).toEqual([
      "Time per build on average",
      "Tokens per build on average",
      "Reworks per build",
      "Human input: prompts and interventions",
    ]);
  });

  it("оставляет проекты в том порядке, в каком их передали", () => {
    const charts = referenceChartsOf(referenceProjects(), "en");

    expect(charts.map((chart) => chart.bars.map((bar) => bar.label))).toEqual([
      ["Split the Bill", "dupes"],
      ["Split the Bill", "dupes"],
      ["Split the Bill", "dupes"],
      ["Split the Bill", "dupes"],
    ]);
  });

  it("пишет время на сборку длительностью", () => {
    const [durationChart] = referenceChartsOf(referenceProjects(), "ru");

    expect(durationChart?.bars.map((bar) => bar.valueText)).toEqual(["22 мин 26 с", "25 мин 52 с"]);
  });

  it("округляет токены на сборку до целых", () => {
    const [, tokensChart] = referenceChartsOf(referenceProjects(), "en");

    expect(tokensChart?.bars.map((bar) => [bar.value, bar.valueText])).toEqual([
      [360_859, "360,859"],
      [601_433, "601,433"],
    ]);
  });

  it("округляет возвраты на сборку до сотых", () => {
    const [, , reworksChart] = referenceChartsOf(referenceProjects(), "ru");

    expect(reworksChart?.bars.map((bar) => [bar.value, bar.valueText])).toEqual([
      [0.43, "0,43"],
      [1.33, "1,33"],
    ]);
  });

  it("складывает участие человека из промптов и вмешательств", () => {
    const [, , , humanChart] = referenceChartsOf(referenceProjects(), "en");

    expect(humanChart?.bars.map((bar) => bar.value)).toEqual([9, 1]);
  });

  it("без проектов оставляет диаграммы пустыми", () => {
    const charts = referenceChartsOf([], "en");

    expect(charts.every((chart) => chart.bars.length === 0)).toBe(true);
  });
});
