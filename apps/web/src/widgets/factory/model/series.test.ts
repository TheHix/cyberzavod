import { afterEach, describe, expect, it } from "vitest";
import type { BriefSessionRecord } from "@cyberzavod/core";
import type { SeriesBuild } from "../lib/series-builds.ts";
import { createFactorySeries, type FactorySeries } from "./series.ts";

// A two-minute build: plan, then code.
function recordingOf(id: string): BriefSessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "split-bill",
    source: { type: "manual" },
    data: {
      title: `Сборка ${id}`,
      language: "ru",
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 60_000, type: "stage_enter", stage: "implementation" },
        { t: 120_000, type: "build_end", ok: true },
      ],
    },
  };
}

function buildsOf(ids: readonly string[]): SeriesBuild[] {
  return ids.map((id, index) => ({
    recording: recordingOf(id),
    project: { name: "Делим счёт", url: "/ru/projects/split-bill/" },
    position: { index, count: ids.length },
  }));
}

const stops: (() => void)[] = [];

// A series that follows the floor; following is removed after the test.
function followedSeries(ids: readonly string[]): FactorySeries {
  const series = createFactorySeries(buildsOf(ids));

  stops.push(series.follow());

  return series;
}

function playToEnd(series: FactorySeries): void {
  series.model.advance(series.model.$playback.get().duration);
}

function currentId(series: FactorySeries): string {
  return series.$current.get().recording.id;
}

describe("createFactorySeries", () => {
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  it("начинает с первой сборки", () => {
    const series = createFactorySeries(buildsOf(["first", "second"]));

    expect([currentId(series), series.model.$recordingId.get()]).toEqual(["first", "first"]);
  });

  it("ставит следующую сборку, когда запись доиграла до конца, и продолжает", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(true);

    playToEnd(series);

    expect({
      current: currentId(series),
      recording: series.model.$recordingId.get(),
      position: series.model.$playback.get().position,
      playing: series.model.$playing.get(),
    }).toEqual({ current: "second", recording: "second", position: 0, playing: true });
  });

  it("после последней сборки снова идёт первая", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(true);
    playToEnd(series);

    playToEnd(series);

    expect(currentId(series)).toBe("first");
  });

  it("ждёт, пока человек держит паузу", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(true);
    series.model.advance(1_000);

    series.model.pause();

    expect({ current: currentId(series), playing: series.model.$playing.get() }).toEqual({
      current: "first",
      playing: false,
    });
  });

  it("не переходит дальше, когда на паузе перемотали в конец", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(false);

    series.model.seek(series.model.$playback.get().duration);

    expect(currentId(series)).toBe("first");
  });

  it("после перемотки назад доигрывает запись и переходит к следующей", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(true);
    series.model.advance(series.model.$playback.get().duration - 100);
    series.model.seek(0);

    playToEnd(series);

    expect(currentId(series)).toBe("second");
  });

  it("сохраняет скорость при смене сборки", () => {
    const series = followedSeries(["first", "second"]);

    series.model.start(true);
    series.model.setSpeed(4);

    playToEnd(series);

    expect(series.model.$playback.get().speed).toBe(4);
  });

  it("не трогает цех, пока за ним не следят", () => {
    const series = createFactorySeries(buildsOf(["first", "second"]));

    series.model.start(true);

    playToEnd(series);

    expect({ current: currentId(series), playing: series.model.$playing.get() }).toEqual({
      current: "first",
      playing: false,
    });
  });

  it("бросает ошибку на серии без сборок", () => {
    const act = () => createFactorySeries([]);

    expect(act).toThrow(Error);
  });
});
