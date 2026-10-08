import type { SessionRecord } from "@cyberzavod/core";
import { oldestFirst } from "./order.ts";

/** Сборки одного проекта по порядку задач: от каркаса до последней доработки. */
export interface ProjectSeries {
  /** Идентификатор проекта, как в записях и в карточке. */
  readonly projectId: string;
  /** Записи проекта, начатые раньше — первыми. */
  readonly recordings: readonly SessionRecord[];
}

function projectIdsInOrderOfAppearance(ordered: readonly SessionRecord[]): readonly string[] {
  const projectIds = ordered.map((recording) => recording.projectId);

  return [...new Set(projectIds)];
}

/**
 * Раскладывает записи по проектам: проекты — в порядке, в каком завод за них брался, сборки
 * внутри — по порядку задач. Так их показывают списки и так цех проигрывает серию.
 * @param {readonly SessionRecord[]} recordings Записи сборок в любом порядке.
 * @returns {readonly ProjectSeries[]} Серии проектов; проект без записей сюда не попадает.
 */
export function projectSeriesOf(recordings: readonly SessionRecord[]): readonly ProjectSeries[] {
  const ordered = [...recordings].sort(oldestFirst);
  const projectIds = projectIdsInOrderOfAppearance(ordered);

  return projectIds.map((projectId) => ({
    projectId,
    recordings: ordered.filter((recording) => recording.projectId === projectId),
  }));
}
