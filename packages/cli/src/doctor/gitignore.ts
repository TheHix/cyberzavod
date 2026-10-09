// `.gitignore` check: adapter working files with the original prompt text do not go into git.

import { captureIgnoreEntry, GITIGNORE_FILE, hasIgnoreEntry } from "../commands/gitignore.ts";
import { failed, passed, type ProjectCheck } from "./check.ts";

/**
 * The root `.gitignore` has the `captureIgnoreEntry(journal)` line; a journal outside the project
 * needs nothing.
 */
export const gitignoreCheck: ProjectCheck = {
  id: "gitignore",
  run: async ({ project, messages }) => {
    const { gitignore } = messages.doctor;
    const entry = captureIgnoreEntry(project.config.journal);

    if (entry === undefined) return passed(gitignore.nothingToIgnore);

    if (await hasIgnoreEntry(project.root, entry)) return passed(gitignore.passed(entry));

    return failed({
      problem: gitignore.missing(entry),
      fix: gitignore.add({ entry, file: GITIGNORE_FILE }),
    });
  },
};
