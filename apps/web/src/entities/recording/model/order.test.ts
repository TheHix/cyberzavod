import { describe, expect, it } from "vitest";
import type { Recording } from "@cyberzavod/core";
import { newestFirst } from "./order.ts";

function recordingOf(id: string, startedAt: string): Recording {
  return {
    version: 2,
    id,
    project: "test",
    factory: "0.0.0",
    startedAt,
    title: "Сборка",
    events: [
      { t: 0, type: "build_start" },
      { t: 1, type: "build_end", ok: true },
    ],
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
