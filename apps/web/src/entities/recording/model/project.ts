import type { SessionRecord } from "@cyberzavod/core";
import { projectSeriesOf } from "./series.ts";

/**
 * Picks the builds of one project in task order, the same order as in the project series.
 * @param {readonly SessionRecord[]} recordings Build recordings in any order.
 * @param {string} projectId Project id.
 * @returns {readonly SessionRecord[]} This project's recordings, earliest started first.
 */
export function recordingsOfProject(
  recordings: readonly SessionRecord[],
  projectId: string,
): readonly SessionRecord[] {
  const projectSeries = projectSeriesOf(recordings);
  const series = projectSeries.find((candidate) => candidate.projectId === projectId);

  return series?.recordings ?? [];
}
