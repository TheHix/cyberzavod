import type { SessionRecord } from "@cyberzavod/core";

/**
 * Выбирает записи одного проекта.
 * @param {readonly SessionRecord[]} recordings Записи сборок.
 * @param {string} projectId Идентификатор проекта.
 * @returns {readonly SessionRecord[]} Записи этого проекта в исходном порядке.
 */
export function recordingsOfProject(
  recordings: readonly SessionRecord[],
  projectId: string,
): readonly SessionRecord[] {
  return recordings.filter((recording) => recording.projectId === projectId);
}
