// Проверка команд проверок запуском (`doctor --run-checks`): каждая команда по отдельности
// оболочкой системы в корне проекта.

import type { DoctorMessages } from "../messages/cli-messages.ts";
import { failed, LIST_SEPARATOR, passed, type CommandRun, type ProjectCheck } from "./check.ts";
import { noCommandsResult } from "./no-commands.ts";

// Что сказать о неудавшемся запуске; undefined, если команда прошла.
function failureOf(command: string, run: CommandRun, doctor: DoctorMessages): string | undefined {
  switch (run.kind) {
    case "exited":
      return run.code === 0 ? undefined : doctor.commands.exited({ command, code: run.code });
    case "notStarted":
      return doctor.commands.notStarted({ command, reason: run.reason });
  }
}

/** Каждая из `verification.commands` завершается с кодом 0. */
export const commandsPassCheck: ProjectCheck = {
  id: "commands",
  run: async ({ project, messages, runCommand }) => {
    const { commands } = messages.doctor;
    const configured = project.config.verification.commands;

    if (configured.length === 0) return noCommandsResult(messages);

    const runs = configured.map((command) => ({
      command,
      failure: failureOf(command, runCommand(command, project.root), messages.doctor),
    }));
    const failedRuns = runs.filter(({ failure }) => failure !== undefined);

    if (failedRuns.length === 0) return passed(commands.allPassed(configured.length));

    const descriptions = failedRuns.map(({ failure }) => failure).join(LIST_SEPARATOR);
    const quotedCommands = failedRuns.map(({ command }) => commands.quoted(command));

    return failed({
      problem: commands.failed(descriptions),
      fix: commands.runYourself(quotedCommands.join(LIST_SEPARATOR)),
    });
  },
};
