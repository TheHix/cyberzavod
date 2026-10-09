// Actually running the check commands for `doctor --run-checks`.

import { spawnSync } from "node:child_process";
import type { CommandRun, CommandRunner } from "./check.ts";

/**
 * Runs a command with the system shell in the project root and discards the output.
 * @param {string} command Check command from the config.
 * @param {string} root Project root.
 * @returns {CommandRun} Exit code or the reason the command did not start.
 */
export const runCommandInShell: CommandRunner = (command, root) => {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "ignore" });

  if (result.error !== undefined) return { kind: "notStarted", reason: result.error.message };

  if (result.status === null) return { kind: "notStarted", reason: String(result.signal) };

  return { kind: "exited", code: result.status };
};
