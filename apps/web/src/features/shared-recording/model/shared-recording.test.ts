import { describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import type { SharedRecording } from "@/entities/gallery";
import { createSharedRecordingModel } from "./shared-recording.ts";

function sharedRecordingOf(slug: string): SharedRecording {
  const record: SessionRecord = {
    version: 1,
    type: "session",
    id: slug,
    timestamp: "2026-10-05T08:00:00.000Z",
    projectId: "lab",
    source: { type: "manual" },
    data: {
      title: "Лаборатория",
      language: "ru",
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 1, type: "build_end", ok: true },
      ],
    },
  };

  return { owner: "alice", galleryPublic: false, record };
}

describe("createSharedRecordingModel", () => {
  it("начинает с загрузки", () => {
    const model = createSharedRecordingModel((slug) => Promise.resolve(sharedRecordingOf(slug)));

    const state = model.$recording.get();

    expect(state).toEqual({ status: "loading" });
  });

  it("открывает запись по slug из адреса", async () => {
    const model = createSharedRecordingModel((slug) => Promise.resolve(sharedRecordingOf(slug)));

    await model.open("?id=k3f9x2m1q8zt");

    expect(model.$recording.get()).toEqual({
      status: "ready",
      value: sharedRecordingOf("k3f9x2m1q8zt"),
    });
  });

  it("называет запись отсутствующей, если в адресе нет slug", async () => {
    const fetchRecording = vi.fn((slug: string) => Promise.resolve(sharedRecordingOf(slug)));
    const model = createSharedRecordingModel(fetchRecording);

    await model.open("");

    expect({ state: model.$recording.get(), calls: fetchRecording.mock.calls.length }).toEqual({
      state: { status: "missing" },
      calls: 0,
    });
  });

  it("шлёт один запрос, когда запись открывают цех и журнал", async () => {
    const fetchRecording = vi.fn((slug: string) => Promise.resolve(sharedRecordingOf(slug)));
    const model = createSharedRecordingModel(fetchRecording);

    await Promise.all([model.open("?id=abc"), model.open("?id=abc")]);

    expect(fetchRecording).toHaveBeenCalledTimes(1);
  });
});
