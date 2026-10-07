// Проект, в котором запущена команда: корень, конфиг и журнал.

import {
  findProjectRoot,
  journalDirectory,
  readProjectConfig,
  type ProjectFileError,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { CommandError } from "../errors.ts";

/** Подключённый проект. */
export interface ProjectAt {
  root: string;
  config: ProjectConfig;
  journal: string;
}

/**
 * Находит проект каталога: поднимается вверх до маркера `.cyberzavod/`.
 * @param {string} directory Каталог, из которого запущена команда.
 * @returns {Promise<ProjectAt>} Проект.
 * @throws {CommandError} Если каталог не в подключённом проекте.
 * @throws {ProjectFileError} Если конфиг проекта битый.
 */
export async function requireProjectAt(directory: string): Promise<ProjectAt> {
  const root = await findProjectRoot(directory);
  const config = root === undefined ? undefined : await readProjectConfig(root);

  if (root === undefined || config === undefined) {
    throw new CommandError(`${directory} не в проекте Cyberzavod: сначала cyberzavod init`);
  }

  return { root, config, journal: journalDirectory(root, config) };
}
