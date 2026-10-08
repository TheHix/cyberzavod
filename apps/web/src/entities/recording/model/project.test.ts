import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { recordingsOfProject } from "./project.ts";

function recordingOf(id: string, project: string, timestamp: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp,
    projectId: project,
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

describe("recordingsOfProject", () => {
  it("оставляет только записи проекта по порядку задач", () => {
    const recordings = [
      recordingOf("third", "alpha", "2026-10-07T23:00:00.000Z"),
      recordingOf("second", "beta", "2026-10-07T22:00:00.000Z"),
      recordingOf("first", "alpha", "2026-10-07T21:00:00.000Z"),
    ];

    const ids = recordingsOfProject(recordings, "alpha").map((recording) => recording.id);

    expect(ids).toEqual(["first", "third"]);
  });

  it("у проекта без записей отдаёт пустой список", () => {
    const recordings = [recordingOf("first", "alpha", "2026-10-07T21:00:00.000Z")];

    const builds = recordingsOfProject(recordings, "beta");

    expect(builds).toEqual([]);
  });
});
