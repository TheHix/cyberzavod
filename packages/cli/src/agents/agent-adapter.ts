// The agent adapter as the CLI sees it: one interface for everything the commands need from an
// agent. The CLI owns the interface, each agent's object in this directory is built on top of that
// agent's adapter package, which knows nothing about the CLI.

import type { InterfaceLanguage } from "@cyberzavod/core";
import type {
  DisconnectPlan,
  HookOutcome,
  HooksInspection,
  PlannedProject,
  SyncReport,
} from "@cyberzavod/adapter-claude";
import type { MachineCheck, ProjectCheck } from "../doctor/check.ts";
import type { Installation } from "../installation/installation.ts";
import type { Environment } from "../messages/language.ts";

/** Agents the CLI can drive; a new agent is a new member here and an object in the registry. */
export const AGENT_NAMES = ["claude"] as const;

/** Name of an agent the CLI can drive. */
export type AgentName = (typeof AGENT_NAMES)[number];

/** The agent a project without `agents` in its config is driven by. */
export const DEFAULT_AGENT_NAME: AgentName = "claude";

/**
 * Whether the text is the name of an agent the CLI can drive.
 * @param {string} name Text, for example `agent` from the project config.
 * @returns {boolean} true for a supported agent.
 */
export function isAgentName(name: string): name is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(name);
}

/** What the project config says about an agent: model provider and agent name. */
export interface AgentIdentity {
  provider: string;
  agent: string;
}

/** How the agent's product and skill calls are written in texts for the human. */
export interface AgentTerms {
  /** Product name, for example `Claude Code`. */
  product: string;
  /** How the human calls a skill by name, for example `/setup`. */
  skill(name: string): string;
}

/** One hook call: the event payload and where it came from. */
export interface HookRequest {
  /** Event JSON from stdin. */
  payload: string;
  /** Directory the CLI was run from. */
  directory: string;
  env: Environment;
  /** Directory for state between hook calls. */
  tmpDir: string;
  language: InterfaceLanguage;
}

/** Which agent files to compare or write and whether the human's files may be overwritten. */
export interface FilesRequest {
  /** Directory inside the project. */
  projectDirectory: string;
  installation: Installation;
  /** Overwrite files written by the human rather than the generator. */
  force: boolean;
}

/** Which session to build a recording draft from. */
export interface DraftRequest {
  /** Directory inside the project. */
  projectDirectory: string;
  /** Raw session log; without it the most recent one is taken. */
  rawPath?: string;
  language: InterfaceLanguage;
}

/** Which draft to publish. */
export interface PublishRequest {
  /** Directory inside the project. */
  projectDirectory: string;
  /** Draft; without it the most recent one is taken. */
  draftPath?: string;
  /** Build of the draft; without it all are published. */
  buildId?: string;
  language: InterfaceLanguage;
}

/**
 * Agent hooks were read (`HooksInspection`) or the file that holds them cannot be parsed
 * (`unreadable`, with the reason in the language of the reader).
 */
export type AgentHooksReading =
  HooksInspection | { kind: "unreadable"; describe(language: InterfaceLanguage): string };

/** Everything the CLI commands need from an agent. */
export interface AgentAdapter {
  readonly name: AgentName;
  /** Provider and agent that `init` writes into the config of each stage with a role. */
  readonly identity: AgentIdentity;
  readonly terms: AgentTerms;
  /** File with the agent's hooks, from the project root with `/`. */
  readonly hooksFile: string;
  /** What `init` says will appear in the project for this agent, from the project root. */
  readonly initFiles: readonly string[];
  /** The agent's own rules file that a human may have written instead of AGENTS.md. */
  readonly legacyRulesFile: string | undefined;
  /** Machine check that the agent's program is installed. */
  readonly programCheck: MachineCheck;
  /** Project checks that only this agent has. */
  readonly extraProjectChecks: readonly ProjectCheck[];
  /** Names the `hook` command accepts for this agent. */
  readonly hookNames: readonly string[];

  /** What generation would do in a project that is not on disk yet, writing nothing. */
  previewFiles(planned: PlannedProject, installation: Installation): Promise<SyncReport>;
  /** What generation would do in the project, writing nothing. */
  inspectFiles(projectDirectory: string, installation: Installation): Promise<SyncReport>;
  /** Brings the agent files in line with the harness and config. */
  syncFiles(request: FilesRequest): Promise<SyncReport>;
  /** Throws if the report has files the human wrote or edited by hand. */
  requireWritable(report: SyncReport): void;
  /** Whether the project has the agent hooks of the version from the config. */
  inspectHooks(root: string, version: string): Promise<AgentHooksReading>;
  /** What disconnecting would remove from the project, writing nothing. */
  planDisconnect(projectDirectory: string): Promise<DisconnectPlan>;
  /** Removes what the adapter wrote into the project. */
  disconnect(projectDirectory: string): Promise<DisconnectPlan>;

  /** Runs a hook of the agent; the name is one of `hookNames`. */
  runHook(name: string, request: HookRequest): Promise<HookOutcome>;
  /** Builds a recording draft from the agent's raw session log; returns the draft path. */
  draftSession(request: DraftRequest): Promise<string>;
  /** Publishes the draft's builds; false if the draft is not ready. */
  publishSessions(request: PublishRequest): Promise<boolean>;

  /** The error's text if it belongs to this adapter, otherwise undefined. */
  describeError(err: unknown, language: InterfaceLanguage): string | undefined;
}
