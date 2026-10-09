import { atom } from "nanostores";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import { createRecordingFiles } from "@/entities/recording-file";
import { createSeriesJournal, type SeriesJournalModel } from "./series-journal.ts";

const SERIES = ["first", "second", "third"] as const;

function sessionOf(id: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "dupes",
    source: { type: "manual" },
    data: {
      title: `Сборка ${id}`,
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

// Series journal with a stub floor and cache: the test sets the recording on the floor and sees
// requests.
function seriesJournal(sceneRecordingId: string | null = null) {
  const fetchFile = vi.fn((id: string) => Promise.resolve(sessionOf(id)));
  const files = createRecordingFiles(fetchFile);
  const $sceneRecordingId = atom<string | null>(sceneRecordingId);
  const journal = createSeriesJournal({
    recordingIds: SERIES,
    $sceneRecordingId,
    $files: files.$files,
    request: files.request,
  });

  return { journal, $sceneRecordingId, fetchFile };
}

const stops: (() => void)[] = [];

function follow(journal: SeriesJournalModel): void {
  stops.push(journal.follow());
}

// Cache requests settle in microtasks: wait until they land in the store.
async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe("createSeriesJournal", () => {
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  it("показывает запись, которая сейчас в цехе", async () => {
    const { journal } = seriesJournal("second");

    follow(journal);
    await settled();

    expect(journal.$recording.get()).toEqual({ status: "ready", value: sessionOf("second") });
  });

  it("пока цех не подключился, показывает первую сборку серии", async () => {
    const { journal } = seriesJournal();

    follow(journal);
    await settled();

    expect(journal.$recording.get()).toEqual({ status: "ready", value: sessionOf("first") });
  });

  it("называет сборку из цеха, пока её запись ещё грузится", () => {
    const { journal } = seriesJournal("second");

    const recordingId = journal.$recordingId.get();

    expect(recordingId).toBe("second");
  });

  it("пока цех не подключился, называет первую сборку серии", () => {
    const { journal } = seriesJournal();

    const recordingId = journal.$recordingId.get();

    expect(recordingId).toBe("first");
  });

  it("пока запись грузится, говорит об этом", () => {
    const { journal } = seriesJournal("second");

    const state = journal.$recording.get();

    expect(state).toEqual({ status: "loading" });
  });

  it("заранее спрашивает следующую сборку серии", async () => {
    const { journal, fetchFile } = seriesJournal("second");

    follow(journal);
    await settled();

    expect(fetchFile.mock.calls).toEqual([["second"], ["third"]]);
  });

  it("после последней сборки заранее спрашивает первую", async () => {
    const { journal, fetchFile } = seriesJournal("third");

    follow(journal);
    await settled();

    expect(fetchFile.mock.calls).toEqual([["third"], ["first"]]);
  });

  it("переходит к новой записи цеха без второго запроса уже полученной", async () => {
    const { journal, $sceneRecordingId, fetchFile } = seriesJournal("first");

    follow(journal);
    await settled();

    $sceneRecordingId.set("second");
    await settled();

    expect({
      recording: journal.$recording.get(),
      calls: fetchFile.mock.calls,
    }).toEqual({
      recording: { status: "ready", value: sessionOf("second") },
      calls: [["first"], ["second"], ["third"]],
    });
  });

  it("перестаёт спрашивать записи, когда за цехом больше не следят", async () => {
    const { journal, $sceneRecordingId, fetchFile } = seriesJournal("first");
    const stop = journal.follow();

    await settled();
    stop();

    $sceneRecordingId.set("third");
    await settled();

    expect(fetchFile.mock.calls).toEqual([["first"], ["second"]]);
  });
});
