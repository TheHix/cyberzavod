// English texts the adapters share.

import { CLI_COMMAND } from "../cli-command.ts";
import type { KitMessages } from "./kit-messages.ts";

/** Shared adapter texts in English. */
export const en: KitMessages = {
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
