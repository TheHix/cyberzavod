// Shared outcome of both command checks: the config has no check commands at all.

import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import type { CliMessages } from "../messages/cli-messages.ts";
import { failed, type CheckResult } from "./check.ts";

/**
 * The "no check commands are set" error.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {CheckResult} A `failed` result with a hint.
 */
export function noCommandsResult(messages: CliMessages): CheckResult {
  return failed({
    problem: messages.doctor.commands.noneSet(PROJECT_CONFIG_FILE),
    fix: messages.doctor.commands.setUp(PROJECT_CONFIG_FILE),
  });
}
