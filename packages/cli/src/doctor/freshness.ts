// Проверка файлов агента: то, что сгенерировано в проекте, совпадает с тем, что соберёт
// запущенный CLI, — так же, как `sync --check`.

import { ClaudeError } from "@cyberzavod/adapter-claude";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { inspectProjectFiles, type ProjectFilesInspection } from "../commands/sync.ts";
import { RULES_FILE } from "../commands/init.ts";
import { HARNESS_VERSION } from "../installation/installation.ts";
import type { DoctorMessages } from "../messages/cli-messages.ts";
import { failed, LIST_SEPARATOR, passed, type CheckResult, type ProjectCheck } from "./check.ts";

function resultOf(inspection: ProjectFilesInspection, doctor: DoctorMessages): CheckResult {
  const { files } = doctor;
  const { report, configVersion, isHarnessOutdated } = inspection;
  const outdatedCount = report.added.length + report.updated.length + report.removed.length;
  const blocked = [...report.conflicts, ...report.edited];

  if (isHarnessOutdated) {
    return failed({
      problem: files.versionsDiffer({
        file: PROJECT_CONFIG_FILE,
        configVersion,
        cliVersion: HARNESS_VERSION,
      }),
      fix: files.matchVersion(configVersion),
    });
  }

  if (blocked.length > 0) {
    return failed({
      problem: files.writtenByHuman(blocked.join(LIST_SEPARATOR)),
      fix: files.moveToRules(RULES_FILE),
    });
  }

  if (outdatedCount > 0) {
    return failed({ problem: files.outdated(outdatedCount), fix: files.sync });
  }

  return passed(files.upToDate);
}

/** Файлы агента актуальны для запущенной версии; версии в конфиге и CLI не расходятся. */
export const freshnessCheck: ProjectCheck = {
  id: "files",
  run: async ({ project, installation, messages, claudeMessages }) => {
    const { files } = messages.doctor;

    try {
      const inspection = await inspectProjectFiles(project, installation);

      return resultOf(inspection, messages.doctor);
    } catch (err) {
      if (err instanceof ClaudeError) {
        return failed({
          problem: files.cannotCheck(err.describe(claudeMessages)),
          fix: files.fixCause,
        });
      }

      throw err;
    }
  },
};
