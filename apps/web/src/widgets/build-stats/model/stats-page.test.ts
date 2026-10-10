import { describe, expect, it } from "vitest";
import type { BuildStats } from "@/entities/stats";
import { createStatsPageModel } from "./stats-page.ts";

function validStats(): BuildStats {
  return {
    recordings: 1,
    authors: 1,
    tokens: 100,
    withoutReworks: 1,
    returns: [],
    interventions: [],
    outcomes: { ok: 1, failed: 0 },
  };
}

describe("createStatsPageModel", () => {
  it("начинает с загрузки", () => {
    const model = createStatsPageModel(() => Promise.resolve(validStats()));

    const state = model.$stats.get();

    expect(state).toEqual({ status: "loading" });
  });

  it("отдаёт аналитику после запроса", async () => {
    const model = createStatsPageModel(() => Promise.resolve(validStats()));

    await model.load();

    expect(model.$stats.get()).toEqual({ status: "ready", value: validStats() });
  });
});
