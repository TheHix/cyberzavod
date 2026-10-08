// Проверка правил проекта: корневой AGENTS.md есть и заготовка `init` в нём заполнена.

import path from "node:path";
import { RULES_TODO_MARK } from "@cyberzavod/core";
import { RULES_FILE } from "../commands/init.ts";
import { readOptionalText } from "../files.ts";
import { failed, passed, type ProjectCheck } from "./check.ts";

/** Корневой AGENTS.md существует и не несёт отметок заглушек `RULES_TODO_MARK`. */
export const rulesCheck: ProjectCheck = {
  run: async ({ project, messages }) => {
    const { rules } = messages.doctor;
    const text = await readOptionalText(path.join(project.root, RULES_FILE));

    if (text === undefined) {
      return failed({ problem: rules.missing(RULES_FILE), fix: rules.create });
    }

    if (text.includes(RULES_TODO_MARK)) {
      return failed({ problem: rules.unfilled(RULES_FILE), fix: rules.fill });
    }

    return passed(rules.passed(RULES_FILE));
  },
};
