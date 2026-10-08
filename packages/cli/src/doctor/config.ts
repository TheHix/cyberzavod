// Проверка конфига проекта: находит проект от каталога и читает `.cyberzavod/project.json`.
// Это единственная проверка, от которой зависит, идут ли дальше проверки проекта.

import {
  findProjectRoot,
  journalDirectory,
  ProjectFileError,
  PROJECT_CONFIG_FILE,
  readProjectConfig,
} from "@cyberzavod/storage";
import type { ProjectAt } from "../commands/project.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { failed, passed, type CheckResult } from "./check.ts";

/** Итог проверки конфига: результат и проект, если он найден и прочитан. */
export interface ConfigCheckOutcome {
  result: CheckResult;
  project: ProjectAt | undefined;
}

function notFound(directory: string, messages: CliMessages): ConfigCheckOutcome {
  const result = failed({
    problem: messages.doctor.config.notFound(directory),
    fix: messages.doctor.config.init,
  });

  return { result, project: undefined };
}

function invalid(err: ProjectFileError, messages: CliMessages): ConfigCheckOutcome {
  const result = failed({
    problem: messages.doctor.config.invalid(err.message),
    fix: messages.doctor.config.repair(PROJECT_CONFIG_FILE),
  });

  return { result, project: undefined };
}

/**
 * Ищет проект от каталога и читает его конфиг.
 * @param {string} directory Каталог, из которого запущена команда.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<ConfigCheckOutcome>} Результат и найденный проект.
 * @throws {Error} Если путь не читается по другой причине, чем «нет файла».
 */
export async function configCheck(
  directory: string,
  messages: CliMessages,
): Promise<ConfigCheckOutcome> {
  const root = await findProjectRoot(directory);

  if (root === undefined) return notFound(directory, messages);

  try {
    const config = await readProjectConfig(root);

    if (config === undefined) return notFound(directory, messages);

    const summary = messages.doctor.config.passed({
      file: PROJECT_CONFIG_FILE,
      projectId: config.projectId,
      harness: config.harness,
    });

    return {
      result: passed(summary),
      project: { root, config, journal: journalDirectory(root, config) },
    };
  } catch (err) {
    if (err instanceof ProjectFileError) return invalid(err, messages);

    throw err;
  }
}
