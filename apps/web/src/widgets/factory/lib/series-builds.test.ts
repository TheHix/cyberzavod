import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@cyberzavod/core";
import type { BuildProject } from "./build-project.ts";
import { seriesBuildsOf } from "./series-builds.ts";

function recordingOf(id: string, language: string): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-07T08:00:00.000Z",
    projectId: "split-bill",
    source: { type: "manual" },
    data: {
      title: `Сборка ${id}`,
      language,
      workflow: "default",
      harness: "0.0.0",
      events: [
        { t: 0, type: "build_start" },
        {
          t: 1_000,
          type: "message",
          from: "foreman",
          to: "planning",
          line: "Начинай",
          text: "Начинай с каркаса.",
        },
        { t: 2_000, type: "build_end", ok: true },
      ],
    },
  };
}

function project(): BuildProject {
  return { name: "Split the Bill", url: "/projects/split-bill/" };
}

describe("seriesBuildsOf", () => {
  it("нумерует сборки по порядку и знает, сколько их у проекта", () => {
    const recordings = [recordingOf("first", "en"), recordingOf("second", "en")];

    const builds = seriesBuildsOf(recordings, project(), "en");

    expect(builds.map((build) => [build.recording.id, build.position])).toEqual([
      ["first", { index: 0, count: 2 }],
      ["second", { index: 1, count: 2 }],
    ]);
  });

  it("отдаёт цеху запись без полных текстов реплик", () => {
    const recordings = [recordingOf("first", "en")];

    const [build] = seriesBuildsOf(recordings, project(), "en");

    expect(build?.recording.data.events[1]).not.toHaveProperty("text");
  });

  it("помечает запись не на языке страницы", () => {
    const recordings = [recordingOf("first", "ru"), recordingOf("second", "en")];

    const builds = seriesBuildsOf(recordings, project(), "en");

    expect(builds.map((build) => build.languageNote)).toEqual(["recorded in Russian", undefined]);
  });

  it("ставит каждой сборке проект серии", () => {
    const recordings = [recordingOf("first", "en"), recordingOf("second", "en")];

    const builds = seriesBuildsOf(recordings, project(), "en");

    expect(builds.map((build) => build.project)).toEqual([project(), project()]);
  });
});
