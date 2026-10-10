// Shared outcome of both command checks: the config has no check commands at all.

import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import type { AgentTerms, CliMessages } from "../messages/cli-messages.ts";
import { failed, type CheckResult } from "./check.ts";

/**
 * The "no check commands are set" error.
 * @param {CliMessages} messages Messages in the chosen language.
 * @param {AgentTerms} terms How the project's agent calls its skills.
 * @returns {CheckResult} A `failed` result with a hint.
 */
export function noCommandsResult(messages: CliMessages, terms: AgentTerms): CheckResult {
  return failed({
    problem: messages.doctor.commands.noneSet(PROJECT_CONFIG_FILE),
    fix: messages.doctor.commands.setUp({ file: PROJECT_CONFIG_FILE, terms }),
  });
}
