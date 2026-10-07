import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { recordingsOfProject } from "./project.ts";

function recordingOf(id: string, project: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-04T08:00:00.000Z",
    projectId: project,
    source: { type: "manual" },
    data: {
      title: "Сборка",
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 1, type: "build_end", ok: true },
      ],
    },
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
