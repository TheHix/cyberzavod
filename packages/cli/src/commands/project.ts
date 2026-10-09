// The project the command runs in: root, config and journal.

import {
  findProjectRoot,
  journalDirectory,
  readProjectConfig,
  type ProjectFileError,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { CommandError } from "../errors.ts";

/** A connected project. */
export interface ProjectAt {
  root: string;
  config: ProjectConfig;
  journal: string;
}

/**
 * Finds the directory's project: walks up to the `.cyberzavod/` marker.
 * @param {string} directory Directory the command was run from.
 * @returns {Promise<ProjectAt>} The project.
 * @throws {CommandError} If the directory is not in a connected project.
 * @throws {ProjectFileError} If the project config is broken.
 */
export async function requireProjectAt(directory: string): Promise<ProjectAt> {
  const root = await findProjectRoot(directory);
  const config = root === undefined ? undefined : await readProjectConfig(root);

  if (root === undefined || config === undefined) {
    throw new CommandError((messages) => messages.errors.projectNotFound(directory));
  }

  return { root, config, journal: journalDirectory(root, config) };
}
