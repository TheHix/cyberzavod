import { briefOf, type BriefSessionRecord, type SessionRecord } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import type { BuildProject } from "./build-project.ts";

/** Место сборки в серии её проекта: «сборка 2 из 7». */
export interface SeriesPosition {
  /** Номер сборки среди сборок проекта по порядку задач, с нуля. */
  readonly index: number;
  /** Сколько сборок у проекта. */
  readonly count: number;
}

/** Сборка серии: запись для цеха и то, что HUD пишет рядом с ней. */
export interface SeriesBuild {
  /** Запись без полных текстов реплик и вмешательств: цеху нужна только строка. */
  readonly recording: BriefSessionRecord;
  readonly project: BuildProject;
  /** Пометка о языке оригинала записи; нет, если запись на языке страницы. */
  readonly languageNote?: string | undefined;
  readonly position: SeriesPosition;
}

/**
 * Собирает сборки одного проекта в серию для цеха: запись без полных текстов, проект и место
 * сборки среди сборок проекта.
 * @param {readonly SessionRecord[]} recordings Записи проекта по порядку задач.
 * @param {BuildProject} project Проект этих записей.
 * @param {Locale} locale Язык страницы: на нём пометка о языке записи.
 * @returns {SeriesBuild[]} Сборки серии в том же порядке.
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
