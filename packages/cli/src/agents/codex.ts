// The Codex adapter as the CLI uses it: the adapter package's functions behind the CLI's
// `AgentAdapter` interface. This is the only file in the CLI that calls them.

import { KIT_MESSAGES, KitError, requireWritable } from "@cyberzavod/adapter-kit";
import {
  carryOverTrust,
  CODEX_AGENT,
  CODEX_MESSAGES,
  CODEX_PROVIDER,
  CodexError,
  disconnectCodex,
  HOOKS_FILE,
  inspectCodexHooks,
  inspectTrust,
  planConnectTrust,
  planDisconnectTrust,
  previewCodex,
  syncCodex,
  type CodexHomeSource,
  type CodexInstallation,
  type TrustInspection,
} from "@cyberzavod/adapter-codex";
import type { InterfaceLanguage } from "@cyberzavod/core";
import { codexCheck } from "../doctor/codex.ts";
import { trustCheckFor } from "../doctor/trust.ts";
import { CommandError } from "../errors.ts";
import type { Installation } from "../installation/installation.ts";
import type { AgentTerms } from "../messages/cli-messages.ts";
import type {
  AgentAdapter,
  AgentHooksReading,
  FilesRequest,
  UserConfigAccess,
  UserConfigReading,
} from "./agent-adapter.ts";

const terms: AgentTerms = {
  product: "Codex",
  skill: (name) => `$${name}`,
};

function codexInstallationOf(installation: Installation): CodexInstallation {
  return { harness: installation.harness, templates: installation.codexTemplates };
}

async function inspectHooks(root: string, version: string): Promise<AgentHooksReading> {
  const reading = await inspectCodexHooks(root, version);

  if (reading.kind !== "unreadable") return reading;

  const { error } = reading;

  return {
    kind: "unreadable",
    describe: (language) => error.describe(KIT_MESSAGES[language]),
  };
}

function readingOf(inspection: TrustInspection): UserConfigReading {
  switch (inspection.kind) {
    case "trusted":
      return { kind: "ready", file: inspection.file };
    case "projectUntrusted":
    case "hooksUntrusted":
      return inspection;

    case "unreadable": {
      const { error } = inspection;

      return {
        kind: "unreadable",
        describe: (language) =>
          error instanceof KitError
            ? error.describe(KIT_MESSAGES[language])
            : error.describe(CODEX_MESSAGES[language]),
      };
    }
  }
}

function userConfigOf(source: CodexHomeSource): UserConfigAccess {
  return {
    planConnect: (target) => planConnectTrust(source, target),
    carryOver: (root, action) => carryOverTrust(source, root, action),
    inspect: async (root) => readingOf(await inspectTrust(source, root)),
    planDisconnect: (root) => planDisconnectTrust(source, root),
  };
}

// Recording a Codex session is not built yet: the hooks Codex runs are generated, but the commands
// that answer them come later.
function unavailable(command: string): never {
  throw new CommandError((m) => m.errors.agentCommandUnavailable({ agent: CODEX_AGENT, command }));
}

function describeCodexError(err: unknown, language: InterfaceLanguage): string | undefined {
  if (err instanceof CodexError) return err.describe(CODEX_MESSAGES[language]);

  return err instanceof KitError ? err.describe(KIT_MESSAGES[language]) : undefined;
}

/**
 * Codex: `openai`/`codex`, files in `.codex/` and `.agents/skills/`, hooks in `.codex/hooks.json`,
 * trust in the human's own `config.toml`.
 * @param {CodexHomeSource} source Environment and home directory, which tell where the human's
 *   Codex config is.
 * @returns {AgentAdapter} The Codex adapter.
 */
export function createCodexAdapter(source: CodexHomeSource): AgentAdapter {
  const userConfig = userConfigOf(source);

  return {
    name: "codex",
    identity: { provider: CODEX_PROVIDER, agent: CODEX_AGENT },
    terms,
    hooksFile: HOOKS_FILE,
    initFiles: [".codex/", ".agents/skills/"],
    legacyRulesFile: undefined,
    programCheck: codexCheck,
    extraProjectChecks: [trustCheckFor(userConfig, terms)],
    hookNames: [],
    userConfig,

    previewFiles: (planned, installation) =>
      previewCodex(planned, codexInstallationOf(installation)),
    inspectFiles: (projectDirectory, installation) =>
      syncCodex({
        projectDirectory,
        installation: codexInstallationOf(installation),
        check: true,
      }),
    syncFiles: ({ projectDirectory, installation, force }: FilesRequest) =>
      syncCodex({ projectDirectory, installation: codexInstallationOf(installation), force }),
    requireWritable,
    inspectHooks,
    planDisconnect: (projectDirectory) => disconnectCodex({ projectDirectory, check: true }),
    disconnect: (projectDirectory) => disconnectCodex({ projectDirectory }),

    runHook: (name) => unavailable(`hook ${name}`),
    draftSession: () => unavailable("draft"),
    publishSessions: () => unavailable("publish"),
    describeError: describeCodexError,
  };
}
