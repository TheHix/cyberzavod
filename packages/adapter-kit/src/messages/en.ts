// English texts the adapters share.

import { CLI_COMMAND } from "../cli-command.ts";
import type { KitMessages } from "./kit-messages.ts";

/** Shared adapter texts in English. */
export const en: KitMessages = {
  stop: {
    configUnreadable: ({ file, reason }) =>
      `The config ${file} cannot be read — checks were skipped, the agent is released. ${reason}`,
    gitUnavailable: (reason) =>
      `The stop hook could not run git — checks were skipped, the agent is released. ${reason}`,
    counterNotSaved: (file) =>
      `The stop hook could not write the attempt counter (${file}) — checks are red, the agent is released without retries.`,
    checksFailing: ({ command, attempt, maxAttempts, output }) =>
      `${command} fails — you cannot finish yet (attempt ${attempt} of ${maxAttempts}). Fix:\n${output}\n`,
    humanCalled: (maxAttempts) =>
      `Checks are still red after ${maxAttempts} attempts to fix them — the agent is stopped, a human is needed.`,
    markerNotSaved: "The marker for the recording was not saved.",
  },
  record: {
    sessionNotRecorded: (reason) => `session not recorded: ${reason}`,
    markerNotClaimed: ({ file, reason }) => `marker ${file} was not claimed: ${reason}`,
  },
  errors: {
    fileConflicts: (files) =>
      `nothing was changed: these files are yours (not generated, or generated and then edited by hand): ${files}. Move your edits to AGENTS.md and delete the files, or overwrite them with ${CLI_COMMAND} sync --force`,
    settingsNotObject: (file) => `${file} cannot be parsed: the settings must be an object`,
    settingsNotParsed: ({ file, reason }) => `${file} cannot be parsed: ${reason}`,
    manifestNotParsed: ({ file, reason }) =>
      `${file} cannot be parsed: ${reason}. Restore it from git, or delete it and run ${CLI_COMMAND} sync`,
    unknownPlaceholder: (placeholder) => `the template has an unknown placeholder ${placeholder}`,
    projectNotFound: (directory) =>
      `${directory} is not in a Cyberzavod project: run ${CLI_COMMAND} init first`,
  },
};
