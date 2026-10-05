import { describe, expect, it } from "vitest";
import type { Recording } from "@cyberzavod/core";
import { recordingsOfProject } from "./project.ts";

function recordingOf(id: string, project: string): Recording {
  return {
    version: 2,
    id,
    project,
    factory: "0.0.0",
    startedAt: "2026-10-04T08:00:00.000Z",
    title: "Сборка",
    events: [
      { t: 0, type: "build_start" },
      { t: 1, type: "build_end", ok: true },
    ],
  };
}

describe("recordingsOfProject", () => {
  it("оставляет только записи проекта в исходном порядке", () => {
    const recordings = [
      recordingOf("first", "alpha"),
      recordingOf("second", "beta"),
      recordingOf("third", "alpha"),
    ];

    const ids = recordingsOfProject(recordings, "alpha").map((recording) => recording.id);

    expect(ids).toEqual(["first", "third"]);
  });
});
