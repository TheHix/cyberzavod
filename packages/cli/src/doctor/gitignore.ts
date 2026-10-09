// Проверка `.gitignore`: рабочие файлы адаптеров с исходным текстом промптов не идут в git.

import { captureIgnoreEntry, GITIGNORE_FILE, hasIgnoreEntry } from "../commands/gitignore.ts";
import { failed, passed, type ProjectCheck } from "./check.ts";

/** В `.gitignore` корня есть строка `captureIgnoreEntry(journal)`; журнал вне проекта — нечего. */
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
