// Node check: hooks and the CLI need the version from the package's `engines`.

import { failed, passed, type MachineCheck } from "./check.ts";

/** The lowest major Node version; matches `engines.node` in the package's `package.json`. */
export const MINIMUM_NODE_MAJOR = 22;

/** The Node version is not below `MINIMUM_NODE_MAJOR`. */
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
