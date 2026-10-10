import { describe, expect, it } from "vitest";
import type { SessionEvent, SessionRecord, Stage } from "@cyberzavod/core";
import { reworksByStageOf } from "./reworks.ts";

function recordingReturnedBy(stages: readonly Stage[]): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    ...stages.map((stage, index): SessionEvent => {
      return { t: index + 1, type: "stage_fail", stage, reason: "Этап вернул работу" };
    }),
    { t: 100, type: "build_end", ok: true },
  ];

  return {
    version: 1,
    type: "session",
    id: "2026-10-07-79fd668f",
    timestamp: "2026-10-07T21:39:18.968Z",
    projectId: "split-bill",
    source: { type: "manual" },
    data: { title: "Сборка", language: "ru", workflow: "default", harness: "0.0.0", events },
  };
}

describe("reworksByStageOf", () => {
  it("суммирует возвраты этапа по всем сборкам", () => {
    const recordings = [
      recordingReturnedBy(["review", "review"]),
      recordingReturnedBy(["review", "verification"]),
    ];

    const reworks = reworksByStageOf(recordings);

    expect(reworks).toEqual([
      { stage: "review", count: 3 },
      { stage: "verification", count: 1 },
    ]);
  });

  it("отдаёт этапы в порядке процесса, а не в порядке возвратов", () => {
    const recordings = [recordingReturnedBy(["verification", "implementation", "review"])];

    const stages = reworksByStageOf(recordings).map(({ stage }) => stage);

    expect(stages).toEqual(["implementation", "review", "verification"]);
  });

  it("не показывает этапы без возвратов", () => {
    const recordings = [recordingReturnedBy([]), recordingReturnedBy(["review"])];

    const stages = reworksByStageOf(recordings).map(({ stage }) => stage);

    expect(stages).toEqual(["review"]);
  });

  it("у сборок без возвратов список пуст", () => {
    const reworks = reworksByStageOf([recordingReturnedBy([])]);

    expect(reworks).toEqual([]);
  });
});
