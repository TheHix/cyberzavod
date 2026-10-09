// Claude Code check: it is currently the only agent Cyberzavod drives fully. The `claude` program
// may be missing even with a working install (the desktop app and the IDE extension), so its
// absence is a notice, not an error.

import { notice, passed, type MachineCheck } from "./check.ts";

const CLAUDE_PROGRAM = "claude";

/** The `claude` program is found in `PATH`. */
export const claudeCodeCheck: MachineCheck = {
  id: "claude-code",
  run: async (machine, messages) => {
    const { claudeCode } = messages.doctor;
    const isInstalled = await machine.isProgramAvailable(CLAUDE_PROGRAM);

    if (isInstalled) return passed(claudeCode.passed);

    return notice({ summary: claudeCode.missing, hint: claudeCode.install });
  },
};
