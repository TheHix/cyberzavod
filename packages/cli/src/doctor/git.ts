// Проверка git: хук остановки и отпечаток кода в начале хода работают через него.

import { failed, passed, type MachineCheck } from "./check.ts";

const GIT_PROGRAM = "git";

/** git найден в `PATH`. */
export const gitCheck: MachineCheck = {
  id: "git",
  run: async (machine, messages) => {
    const isInstalled = await machine.isProgramAvailable(GIT_PROGRAM);

    if (isInstalled) return passed(messages.doctor.git.passed);

    return failed({ problem: messages.doctor.git.missing, fix: messages.doctor.git.install });
  },
};
