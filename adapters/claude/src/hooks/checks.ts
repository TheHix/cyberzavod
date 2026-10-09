// Project checks for hooks: what to run, and which directories' changes require it.

import { closeSync, openSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { ProjectConfig } from "@cyberzavod/core";

/** Project checks: one command and the code directories the hooks watch. */
export interface ProjectChecks {
  command: string;
  paths: string[];
}

/** Outcome of a checks run: whether they passed and what they printed. */
export interface ChecksRun {
  passed: boolean;
  output: string;
}

const WHOLE_REPOSITORY = ".";
// Both sh and cmd.exe understand `&&`: the first red command stops the rest.
const COMMAND_SEPARATOR = " && ";

/**
 * Checks from the project config.
 * @param {ProjectConfig} config Project config.
 * @returns {ProjectChecks | undefined} The checks, or undefined if there are no commands.
 */
export function checksOf(config: ProjectConfig): ProjectChecks | undefined {
  const { commands, paths } = config.verification;

  if (commands.length === 0) return undefined;

  return {
    command: commands.join(COMMAND_SEPARATOR),
    paths: paths.length === 0 ? [WHOLE_REPOSITORY] : paths,
  };
}

/**
 * Runs the checks with the system shell in the project root. Output goes to a file, not a pipe, so
 * stdout and stderr keep the order in which the command printed them.
 * @param {ProjectChecks} checks Project checks.
 * @param {string} root Project root.
 * @param {string} outputFile Temporary file for the output; deleted after the run.
 * @returns {ChecksRun} Whether the checks passed, and their output.
 */
export function runChecks(checks: ProjectChecks, root: string, outputFile: string): ChecksRun {
  const output = openSync(outputFile, "w");

  try {
    const result = spawnSync(checks.command, {
      cwd: root,
      shell: true,
      stdio: ["ignore", output, output],
    });
    const printed = readFileSync(outputFile, "utf8");

    if (result.error !== undefined) {
      return { passed: false, output: `${printed}${result.error.message}\n` };
    }

    return { passed: result.status === 0, output: printed };
  } finally {
    closeSync(output);
    rmSync(outputFile, { force: true });
  }
}
