import type { Recording } from "@cyberzavod/core";

/**
 * Выбирает записи одного проекта.
 * @param {readonly Recording[]} recordings Записи сборок.
 * @param {string} projectId Идентификатор проекта.
 * @returns {readonly Recording[]} Записи этого проекта в исходном порядке.
 */
export function recordingsOfProject(
  recordings: readonly Recording[],
  projectId: string,
): readonly Recording[] {
  return recordings.filter((recording) => recording.project === projectId);
}
