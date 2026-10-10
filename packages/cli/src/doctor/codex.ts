// Codex check. The `codex` program may be missing even with a working install (the desktop app and
// the IDE extension), so its absence is a notice, not an error.

import { notice, passed, type MachineCheck } from "./check.ts";

const CODEX_PROGRAM = "codex";

/** The `codex` program is found in `PATH`. */
export const codexCheck: MachineCheck = {
  id: "codex",
  run: async (machine, messages) => {
    const { codex } = messages.doctor;
    const isInstalled = await machine.isProgramAvailable(CODEX_PROGRAM);

    if (isInstalled) return passed(codex.passed);

    return notice({ summary: codex.missing, hint: codex.install });
  },
};
