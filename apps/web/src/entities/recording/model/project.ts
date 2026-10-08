import type { SessionRecord } from "@cyberzavod/core";
import { projectSeriesOf } from "./series.ts";

/**
 * Выбирает сборки одного проекта по порядку задач — в том же порядке, что в серии проекта.
 * @param {readonly SessionRecord[]} recordings Записи сборок в любом порядке.
 * @param {string} projectId Идентификатор проекта.
 * @returns {readonly SessionRecord[]} Записи этого проекта, начатые раньше — первыми.
 */
export function recordingsOfProject(
  recordings: readonly SessionRecord[],
  projectId: string,
): readonly SessionRecord[] {
  const projectSeries = projectSeriesOf(recordings);
  const series = projectSeries.find((candidate) => candidate.projectId === projectId);

  return series?.recordings ?? [];
}
