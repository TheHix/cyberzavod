// Agent hooks check: `.claude/settings.json` has the handlers of the version in the config.

import {
  inspectClaudeHooks,
  SETTINGS_FILE,
  type ClaudeMessages,
  type HooksReading,
} from "@cyberzavod/adapter-claude";
import type { DoctorMessages } from "../messages/cli-messages.ts";
import { failed, LIST_SEPARATOR, passed, type CheckResult, type ProjectCheck } from "./check.ts";

interface HooksOutcome {
  reading: HooksReading;
  version: string;
  doctor: DoctorMessages;
  claudeMessages: ClaudeMessages;
}

function resultOf({ reading, version, doctor, claudeMessages }: HooksOutcome): CheckResult {
  const { hooks } = doctor;

  switch (reading.kind) {
    case "installed":
      return passed(hooks.passed(version));
    case "missing":
      return failed({ problem: hooks.missing(SETTINGS_FILE), fix: hooks.sync });
    case "otherVersion":
      return failed({
        problem: hooks.otherVersion({
          file: SETTINGS_FILE,
          found: reading.found.join(LIST_SEPARATOR),
          configVersion: version,
        }),
        fix: hooks.sync,
      });
    case "incomplete":
      return failed({
        problem: hooks.incomplete(reading.events.join(LIST_SEPARATOR)),
        fix: hooks.sync,
      });
    case "unreadable":
      return failed({
        problem: hooks.unreadable(reading.error.describe(claudeMessages)),
        fix: hooks.repairSettings(SETTINGS_FILE),
      });
  }
}

/** The adapter hooks in the project settings match the version from the config. */
export const hooksCheck: ProjectCheck = {
  id: "hooks",
  run: async ({ project, messages, claudeMessages }) => {
    const version = project.config.harness;
    const reading = await inspectClaudeHooks(project.root, version);

    return resultOf({ reading, version, doctor: messages.doctor, claudeMessages });
  },
};
