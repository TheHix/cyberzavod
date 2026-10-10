// Trust check: the agent runs a project's hooks only if the human's own agent config trusts the
// project and approves the hooks. Without it the process silently loses its hooks.

import type { InterfaceLanguage } from "@cyberzavod/core";
import type { UserConfigAccess, UserConfigReading } from "../agents/agent-adapter.ts";
import type { AgentTerms, DoctorMessages } from "../messages/cli-messages.ts";
import { failed, LIST_SEPARATOR, passed, type CheckResult, type ProjectCheck } from "./check.ts";

interface TrustOutcome {
  reading: UserConfigReading;
  trust: DoctorMessages["trust"];
  language: InterfaceLanguage;
  terms: AgentTerms;
}

function resultOf({ reading, trust, language, terms }: TrustOutcome): CheckResult {
  switch (reading.kind) {
    case "ready":
      return passed(trust.passed(reading.file));
    case "projectUntrusted":
      return failed({
        problem: trust.projectUntrusted({ file: reading.file, terms }),
        fix: trust.trustProject({ file: reading.file, projectKey: reading.projectKey, terms }),
      });
    case "hooksUntrusted":
      return failed({
        problem: trust.hooksUntrusted({ events: reading.events.join(LIST_SEPARATOR), terms }),
        fix: trust.approveHooks(terms),
      });
    case "unreadable":
      return failed({
        problem: trust.unreadable(reading.describe(language)),
        fix: trust.repairConfig,
      });
  }
}

/**
 * Trust check of an agent that asks the human for it.
 * @param {UserConfigAccess} userConfig The agent's access to the human's config.
 * @param {AgentTerms} terms How the agent is named in texts.
 * @returns {ProjectCheck} A check with the code `trust`.
 */
export function trustCheckFor(userConfig: UserConfigAccess, terms: AgentTerms): ProjectCheck {
  return {
    id: "trust",
    run: async ({ project, messages, language }) => {
      const reading = await userConfig.inspect(project.root);

      return resultOf({ reading, trust: messages.doctor.trust, language, terms });
    },
  };
}
