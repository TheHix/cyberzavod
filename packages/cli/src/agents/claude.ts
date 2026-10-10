// The Claude Code adapter as the CLI uses it: the adapter package's functions behind the CLI's
// `AgentAdapter` interface. This is the only file in the CLI that calls them.

import {
  CLAUDE_MESSAGES,
  ClaudeError,
  disconnectClaude,
  draftSession,
  HOOK_NAMES,
  inspectClaudeHooks,
  isHookName,
  previewClaude,
  publishSessions,
  requireWritable,
  runHook,
  SETTINGS_FILE,
  syncClaude,
  type ClaudeInstallation,
} from "@cyberzavod/adapter-claude";
import type { InterfaceLanguage } from "@cyberzavod/core";
import { claudeCodeCheck } from "../doctor/claude-code.ts";
import { CommandError } from "../errors.ts";
import type { Installation } from "../installation/installation.ts";
import type {
  AgentAdapter,
  AgentHooksReading,
  AgentTerms,
  DraftRequest,
  FilesRequest,
  HookRequest,
  PublishRequest,
} from "./agent-adapter.ts";

const CLAUDE_PROJECT_DIRECTORY = "CLAUDE_PROJECT_DIR";

const terms: AgentTerms = {
  product: "Claude Code",
  skill: (name) => `/${name}`,
};

function claudeInstallationOf(installation: Installation): ClaudeInstallation {
  return { harness: installation.harness, templates: installation.claudeTemplates };
}

async function inspectHooks(root: string, version: string): Promise<AgentHooksReading> {
  const reading = await inspectClaudeHooks(root, version);

  if (reading.kind !== "unreadable") return reading;

  const { error } = reading;

  return {
    kind: "unreadable",
    describe: (language) => error.describe(CLAUDE_MESSAGES[language]),
  };
}

// Claude Code gives the hook the project directory in an environment variable: its working
// directory may be any subdirectory.
function hookProjectDirectory({ env, directory }: HookRequest): string {
  return env[CLAUDE_PROJECT_DIRECTORY] || directory;
}

function runClaudeHook(name: string, request: HookRequest) {
  if (!isHookName(name)) throw new CommandError((m) => m.errors.unknownHook(name));

  return runHook(name, {
    payload: request.payload,
    projectDirectory: hookProjectDirectory(request),
    tmpDir: request.tmpDir,
    messages: CLAUDE_MESSAGES[request.language],
  });
}

function draftClaudeSession({ projectDirectory, rawPath, language }: DraftRequest) {
  return draftSession({
    projectDirectory,
    messages: CLAUDE_MESSAGES[language],
    ...(rawPath === undefined ? {} : { rawPath }),
  });
}

function publishClaudeSessions(request: PublishRequest) {
  const { projectDirectory, draftPath, buildId, language } = request;

  return publishSessions({
    projectDirectory,
    messages: CLAUDE_MESSAGES[language],
    ...(draftPath === undefined ? {} : { draftPath }),
    ...(buildId === undefined ? {} : { buildId }),
  });
}

function describeClaudeError(err: unknown, language: InterfaceLanguage): string | undefined {
  return err instanceof ClaudeError ? err.describe(CLAUDE_MESSAGES[language]) : undefined;
}

/** Claude Code: `anthropic`/`claude`, files in `CLAUDE.md` and `.claude/`, hooks in the settings. */
export const claudeAdapter: AgentAdapter = {
  name: "claude",
  identity: { provider: "anthropic", agent: "claude" },
  terms,
  hooksFile: SETTINGS_FILE,
  initFiles: ["CLAUDE.md", ".claude/"],
  legacyRulesFile: "CLAUDE.md",
  programCheck: claudeCodeCheck,
  extraProjectChecks: [],
  hookNames: HOOK_NAMES,

  previewFiles: (planned, installation) =>
    previewClaude(planned, claudeInstallationOf(installation)),
  inspectFiles: (projectDirectory, installation) =>
    syncClaude({
      projectDirectory,
      installation: claudeInstallationOf(installation),
      check: true,
    }),
  syncFiles: ({ projectDirectory, installation, force }: FilesRequest) =>
    syncClaude({ projectDirectory, installation: claudeInstallationOf(installation), force }),
  requireWritable,
  inspectHooks,
  planDisconnect: (projectDirectory) => disconnectClaude({ projectDirectory, check: true }),
  disconnect: (projectDirectory) => disconnectClaude({ projectDirectory }),

  runHook: runClaudeHook,
  draftSession: draftClaudeSession,
  publishSessions: publishClaudeSessions,
  describeError: describeClaudeError,
};
