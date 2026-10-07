import type { Project } from "@cyberzavod/core";

/** Ошибка поиска карточки: запись или страница ссылается на проект, которого нет в `projects/`. */
export class UnknownProjectError extends Error {}

/**
 * Находит карточку проекта по id.
 * @param {readonly Project[]} projects Карточки проектов.
 * @param {string} id Идентификатор проекта, например из `SessionRecord.projectId`.
 * @returns {Project} Карточка проекта.
 * @throws {UnknownProjectError} Если карточки с таким id нет.
 */
export function projectOf(projects: readonly Project[], id: string): Project {
  const project = projects.find((candidate) => candidate.id === id);
  if (project === undefined) {
    throw new UnknownProjectError(`у проекта ${id} нет карточки в projects/`);
  }
  return project;
}
