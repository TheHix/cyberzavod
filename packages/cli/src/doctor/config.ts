// Project config check: finds the project from the directory and reads `.cyberzavod/project.json`.
// This is the only check that decides whether the project checks run further.

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

/** Outcome of the config check: the result and the project, if it was found and read. */
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
 * Looks for the project from the directory and reads its config.
 * @param {string} directory Directory the command was run from.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {Promise<ConfigCheckOutcome>} The result and the found project.
 * @throws {Error} If the path cannot be read for a reason other than "no file".
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
