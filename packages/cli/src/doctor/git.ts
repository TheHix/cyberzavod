// git check: the stop hook and the code fingerprint at the start of a turn work through it.

import { failed, passed, type MachineCheck } from "./check.ts";

const GIT_PROGRAM = "git";

/** git is found in `PATH`. */
export const gitCheck: MachineCheck = {
  id: "git",
  run: async (machine, messages) => {
    const isInstalled = await machine.isProgramAvailable(GIT_PROGRAM);

    if (isInstalled) return passed(messages.doctor.git.passed);

    return failed({ problem: messages.doctor.git.missing, fix: messages.doctor.git.install });
  },
};
