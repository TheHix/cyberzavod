import type { SessionRecord } from "@cyberzavod/core";
import { oldestFirst } from "./order.ts";

/** Builds of one project in task order: from the scaffold to the last rework. */
export interface ProjectSeries {
  /** Project id, as in the recordings and the project card. */
  readonly projectId: string;
  /** The project's recordings, earliest started first. */
  readonly recordings: readonly SessionRecord[];
}

function projectIdsInOrderOfAppearance(ordered: readonly SessionRecord[]): readonly string[] {
  const projectIds = ordered.map((recording) => recording.projectId);

  return [...new Set(projectIds)];
}

/**
 * Groups recordings by project: projects in the order the factory took them on, builds within a
 * project in task order. This is how lists show them and how the factory floor plays a series.
 * @param {readonly SessionRecord[]} recordings Build recordings in any order.
 * @returns {readonly ProjectSeries[]} Project series; a project without recordings is left out.
 */
export function projectSeriesOf(recordings: readonly SessionRecord[]): readonly ProjectSeries[] {
  const ordered = [...recordings].sort(oldestFirst);
  const projectIds = projectIdsInOrderOfAppearance(ordered);

  return projectIds.map((projectId) => ({
    projectId,
    recordings: ordered.filter((recording) => recording.projectId === projectId),
  }));
}
