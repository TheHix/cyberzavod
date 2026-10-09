import { briefOf, type BriefSessionRecord, type SessionRecord } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import type { BuildProject } from "./build-project.ts";

/** Place of a build in its project's series: "build 2 of 7". */
export interface SeriesPosition {
  /** Build number among the project's builds in task order, from zero. */
  readonly index: number;
  /** How many builds the project has. */
  readonly count: number;
}

/** A series build: the recording for the floor and what the HUD writes next to it. */
export interface SeriesBuild {
  /** Recording without full message and intervention texts: the floor needs only the line. */
  readonly recording: BriefSessionRecord;
  readonly project: BuildProject;
  /**
   * Note about the recording's original language; absent if the recording is in the page language.
   */
  readonly languageNote?: string | undefined;
  readonly position: SeriesPosition;
}

/**
 * Assembles one project's builds into a series for the floor: the recording without full texts,
 * the project and the build's place among the project's builds.
 * @param {readonly SessionRecord[]} recordings Project recordings in task order.
 * @param {BuildProject} project Project of these recordings.
 * @param {Locale} locale Page language: the recording language note is in it.
 * @returns {SeriesBuild[]} Series builds in the same order.
 */
export function seriesBuildsOf(
  recordings: readonly SessionRecord[],
  project: BuildProject,
  locale: Locale,
): SeriesBuild[] {
  return recordings.map((recording, index) => ({
    recording: briefOf(recording),
    project,
    languageNote: languageNoteOf(recording.data.language, locale),
    position: { index, count: recordings.length },
  }));
}
