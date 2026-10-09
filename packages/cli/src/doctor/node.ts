// Проверка Node: хуки и CLI требуют версию из `engines` пакета.

import { failed, passed, type MachineCheck } from "./check.ts";

/** Наименьшая мажорная версия Node; совпадает с `engines.node` в `package.json` пакета. */
export const MINIMUM_NODE_MAJOR = 22;

/** Версия Node не ниже `MINIMUM_NODE_MAJOR`. */
export const nodeCheck: MachineCheck = {
  id: "node",
  run: async (machine, messages) => {
    const major = Number.parseInt(machine.nodeVersion, 10);
    const isSupported = major >= MINIMUM_NODE_MAJOR;

    if (isSupported) return passed(messages.doctor.node.passed(machine.nodeVersion));

    return failed({
      problem: messages.doctor.node.tooOld({
        version: machine.nodeVersion,
        minimum: MINIMUM_NODE_MAJOR,
      }),
      fix: messages.doctor.node.install(MINIMUM_NODE_MAJOR),
    });
  },
};
