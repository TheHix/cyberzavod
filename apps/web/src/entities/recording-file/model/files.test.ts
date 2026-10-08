import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { ApiRequestError } from "@/shared/api/errors.ts";
import { createRecordingFiles, recordingFileOf } from "./files.ts";

function sessionOf(id: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "doc-diff",
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

describe("createRecordingFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("кладёт полученную запись в кеш", async () => {
    const files = createRecordingFiles((id) => Promise.resolve(sessionOf(id)));

    await files.request("first");

    expect(recordingFileOf(files.$files.get(), "first")).toEqual({
      status: "ready",
      value: sessionOf("first"),
    });
  });

  it("показывает загрузку, пока запись в пути", () => {
    const files = createRecordingFiles(() => new Promise<SessionRecord>(() => undefined));

    void files.request("first");

    expect(files.$files.get()).toEqual({ first: { status: "loading" } });
  });

  it("спрашивает каждую запись один раз", async () => {
    const fetchFile = vi.fn((id: string) => Promise.resolve(sessionOf(id)));
    const files = createRecordingFiles(fetchFile);

    await Promise.all([files.request("first"), files.request("first"), files.request("second")]);

    expect(fetchFile.mock.calls).toEqual([["first"], ["second"]]);
  });

  it("называет запись без файла отсутствующей и больше её не спрашивает", async () => {
    const fetchFile = vi.fn(() => Promise.reject(new ApiRequestError(404, "unknown", "нет")));
    const files = createRecordingFiles(fetchFile);

    await files.request("gone");
    await files.request("gone");

    expect({ state: files.$files.get()["gone"], calls: fetchFile.mock.calls.length }).toEqual({
      state: { status: "missing" },
      calls: 1,
    });
  });

  it("после сбоя сети спрашивает запись снова", async () => {
    const fetchFile = vi
      .fn<(id: string) => Promise<SessionRecord>>()
      .mockRejectedValueOnce(new TypeError("сеть недоступна"))
      .mockResolvedValueOnce(sessionOf("first"));
    const files = createRecordingFiles(fetchFile);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await files.request("first");

    await files.request("first");

    expect(files.$files.get()["first"]?.status).toBe("ready");
  });
});

describe("recordingFileOf", () => {
  it("считает не спрошенную запись загружающейся", () => {
    const state = recordingFileOf({}, "first");

    expect(state).toEqual({ status: "loading" });
  });
});
