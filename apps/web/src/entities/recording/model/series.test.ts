import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { projectSeriesOf } from "./series.ts";

function recordingOf(id: string, projectId: string, timestamp: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp,
    projectId,
    source: { type: "manual" },
    data: {
      title: "Сборка",
      language: "ru",
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 1, type: "build_end", ok: true },
      ],
    },
  };
}

describe("projectSeriesOf", () => {
  it("ставит проекты в порядке, в каком за них брались, а сборки — по порядку задач", () => {
    const recordings = [
      recordingOf("beta-2", "beta", "2026-10-07T22:00:00.000Z"),
      recordingOf("alpha-2", "alpha", "2026-10-07T23:00:00.000Z"),
      recordingOf("beta-1", "beta", "2026-10-07T20:00:00.000Z"),
      recordingOf("alpha-1", "alpha", "2026-10-07T21:00:00.000Z"),
    ];

    const series = projectSeriesOf(recordings);

    expect(
      series.map(({ projectId, recordings: builds }) => [projectId, builds.map(({ id }) => id)]),
    ).toEqual([
      ["beta", ["beta-1", "beta-2"]],
      ["alpha", ["alpha-1", "alpha-2"]],
    ]);
  });

  it("при равном времени упорядочивает сборки по id", () => {
    const recordings = [
      recordingOf("task-b", "alpha", "2026-10-07T20:00:00.000Z"),
      recordingOf("task-a", "alpha", "2026-10-07T20:00:00.000Z"),
    ];

    const [series] = projectSeriesOf(recordings);

    expect(series?.recordings.map(({ id }) => id)).toEqual(["task-a", "task-b"]);
  });

  it("не меняет порядок входного списка", () => {
    const recordings = [
      recordingOf("later", "alpha", "2026-10-07T21:00:00.000Z"),
      recordingOf("earlier", "alpha", "2026-10-07T20:00:00.000Z"),
    ];

    projectSeriesOf(recordings);

    expect(recordings.map(({ id }) => id)).toEqual(["later", "earlier"]);
  });

  it("из пустого списка делает пустой", () => {
    const series = projectSeriesOf([]);

    expect(series).toEqual([]);
  });
});
