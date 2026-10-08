import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { ApiResponseError } from "@/shared/api/errors.ts";
import { parseRecordingFile } from "./parse.ts";

function validSession(): SessionRecord {
  return {
    version: 1,
    type: "session",
    id: "2026-10-07-79fd668f",
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "split-bill",
    source: { type: "manual" },
    data: {
      title: "Каркас",
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

describe("parseRecordingFile", () => {
  it("читает сессию", () => {
    const raw: unknown = JSON.parse(JSON.stringify(validSession()));

    const recording = parseRecordingFile(raw);

    expect(recording).toEqual(validSession());
  });

  it("отклоняет запись, которая не сессия", () => {
    const raw = {
      ...validSession(),
      type: "note",
      data: { text: "Заметка" },
    };

    const act = () => parseRecordingFile(raw);

    expect(act).toThrow(ApiResponseError);
  });

  it("отклоняет битую запись", () => {
    const raw = { ...validSession(), data: { title: "Без событий" } };

    const act = () => parseRecordingFile(raw);

    expect(act).toThrow(ApiResponseError);
  });
});
