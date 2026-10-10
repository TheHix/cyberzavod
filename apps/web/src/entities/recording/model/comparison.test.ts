import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { comparisonOfRecording, taskComparisonsOf } from "./comparison.ts";

function recordingWith(id: string, timestamp: string, task?: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp,
    projectId: "split-bill",
    source: { type: "manual" },
    data: {
      title: "Сборка",
      language: "ru",
      workflow: "default",
      harness: "0.0.0",
      ...(task === undefined ? {} : { task }),
      events: [
        { t: 0, type: "build_start" },
        { t: 1, type: "build_end", ok: true },
      ],
    },
  };
}

describe("taskComparisonsOf", () => {
  it("собирает в сравнение записи с одной меткой", () => {
    const recordings = [
      recordingWith("a", "2026-10-07T21:00:00.000Z", "split-bill"),
      recordingWith("b", "2026-10-07T22:00:00.000Z", "split-bill"),
    ];

    const [comparison] = taskComparisonsOf(recordings);

    expect(comparison?.task).toBe("split-bill");
    expect(comparison?.recordings.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("не считает сравнением единственный прогон метки", () => {
    const recordings = [recordingWith("a", "2026-10-07T21:00:00.000Z", "split-bill")];

    const comparisons = taskComparisonsOf(recordings);

    expect(comparisons).toEqual([]);
  });

  it("не берёт записи без метки", () => {
    const recordings = [
      recordingWith("a", "2026-10-07T21:00:00.000Z"),
      recordingWith("b", "2026-10-07T22:00:00.000Z"),
    ];

    const comparisons = taskComparisonsOf(recordings);

    expect(comparisons).toEqual([]);
  });

  it("ставит прогоны по времени начала, раньше начатый первым", () => {
    const recordings = [
      recordingWith("late", "2026-10-07T23:00:00.000Z", "split-bill"),
      recordingWith("early", "2026-10-07T21:00:00.000Z", "split-bill"),
    ];

    const [comparison] = taskComparisonsOf(recordings);

    expect(comparison?.recordings.map(({ id }) => id)).toEqual(["early", "late"]);
  });

  it("держит метки отдельно друг от друга", () => {
    const recordings = [
      recordingWith("a1", "2026-10-07T21:00:00.000Z", "alpha"),
      recordingWith("b1", "2026-10-07T22:00:00.000Z", "beta"),
      recordingWith("a2", "2026-10-07T23:00:00.000Z", "alpha"),
      recordingWith("b2", "2026-10-08T00:00:00.000Z", "beta"),
    ];

    const comparisons = taskComparisonsOf(recordings);

    expect(comparisons.map(({ task }) => task)).toEqual(["alpha", "beta"]);
  });
});

describe("comparisonOfRecording", () => {
  it("находит сравнение, в которое входит запись", () => {
    const first = recordingWith("a", "2026-10-07T21:00:00.000Z", "split-bill");
    const second = recordingWith("b", "2026-10-07T22:00:00.000Z", "split-bill");

    const comparison = comparisonOfRecording([first, second], second);

    expect(comparison?.task).toBe("split-bill");
  });

  it("не находит сравнение у записи без метки", () => {
    const unlabeled = recordingWith("a", "2026-10-07T21:00:00.000Z");

    const comparison = comparisonOfRecording([unlabeled], unlabeled);

    expect(comparison).toBeUndefined();
  });

  it("не находит сравнение у единственного прогона метки", () => {
    const only = recordingWith("a", "2026-10-07T21:00:00.000Z", "split-bill");

    const comparison = comparisonOfRecording([only], only);

    expect(comparison).toBeUndefined();
  });
});
