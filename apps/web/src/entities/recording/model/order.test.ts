import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { newestFirst } from "./order.ts";

function recordingOf(id: string, timestamp: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp,
    projectId: "test",
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

describe("newestFirst", () => {
  it("ставит первыми записи, начатые позже, в том числе в один день", () => {
    const recordings = [
      recordingOf("2026-10-01-ffff", "2026-10-01T20:00:00.000Z"),
      recordingOf("2026-10-04-ffff", "2026-10-04T08:00:00.000Z"),
      recordingOf("2026-10-04-0000", "2026-10-04T18:00:00.000Z"),
    ];

    const ids = recordings.sort(newestFirst).map((recording) => recording.id);

    expect(ids).toEqual(["2026-10-04-0000", "2026-10-04-ffff", "2026-10-01-ffff"]);
  });
});
