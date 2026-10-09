import type { PublishedProject } from "./published.ts";

/** Card lookup error: a recording or page refers to a project that is not in `projects/`. */
export class UnknownProjectError extends Error {}

/**
 * Finds a project card by id.
 * @param {readonly PublishedProject[]} projects Project cards.
 * @param {string} id Project id, e.g. from `SessionRecord.projectId`.
 * @returns {PublishedProject} The project card.
 * @throws {UnknownProjectError} If there is no card with this id.
 */
export function projectOf(projects: readonly PublishedProject[], id: string): PublishedProject {
  const project = projects.find((candidate) => candidate.id === id);

  if (project === undefined) {
    throw new UnknownProjectError(`у проекта ${id} нет карточки в projects/`);
  }

  return project;
}
