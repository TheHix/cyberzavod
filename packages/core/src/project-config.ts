// Project config is `.cyberzavod/project.json` in its repository: the "project is connected"
// marker and all the workflow needs about the project. No history: records are in the journal.

import { parseAgentConfig, type AgentConfig } from "./agent.ts";
import { isLine, isObject } from "./guards.ts";
import { isHarnessVersion, isRecordId } from "./record.ts";
import { isStage, type Stage } from "./stage.ts";

/**
 * What counts as the project's checks: commands run in order, all must pass.
 * `paths` are code directories: an edit in them requires checks; empty means the whole repository.
 */
export interface VerificationConfig {
  commands: string[];
  paths: string[];
}

/**
 * What `init` and `sync` found in the project: a reference, not a constraint. The stack may change,
 * and `sync` will find it again.
 */
export interface StackInfo {
  languages: string[];
  frameworks: string[];
  /** Package manager, for example `pnpm`; absent if not found. */
  packageManager?: string;
}

/** Config of a project connected to Cyberzavod. */
export interface ProjectConfig {
  /** Project id: letters, digits, "_" and "-". */
  projectId: string;
  /** Harness version the adapter files were generated from. */
  harness: string;
  /** Workflow name from `harness/workflows/`. */
  workflow: string;
  /**
   * Journal directory relative to the project root, with `/`: `journal` is inside the repository,
   * `../<project>.cyberzavod` is next to it.
   */
  journal: string;
  /** Agent for each stage; a stage without an agent is run by the adapter's default. */
  agents: Partial<Record<Stage, AgentConfig>>;
  verification: VerificationConfig;
  stack?: StackInfo;
}

/**
 * Format version of `.cyberzavod/project.json`; not to be confused with the CLI or harness version.
 * A config without the field was written by versions before 0.9.0 and is read as version 1.
 */
export const PROJECT_CONFIG_SCHEMA_VERSION = 1;

/** Project config error: the file failed validation. */
export class ProjectConfigError extends Error {}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLine);
}

function parseAgents(raw: unknown): Partial<Record<Stage, AgentConfig>> {
  if (raw === undefined) return {};
  if (!isObject(raw)) throw new ProjectConfigError("agents must be an object");

  const agents: Partial<Record<Stage, AgentConfig>> = {};

  for (const [stage, agent] of Object.entries(raw)) {
    if (!isStage(stage)) throw new ProjectConfigError(`agents: unknown stage ${stage}`);

    try {
      agents[stage] = parseAgentConfig(agent);
    } catch (err) {
      throw new ProjectConfigError(`agents.${stage}: ${(err as Error).message}`, { cause: err });
    }
  }

  return agents;
}

function parseVerification(raw: unknown): VerificationConfig {
  if (raw === undefined) return { commands: [], paths: [] };
  if (!isObject(raw)) throw new ProjectConfigError("verification must be an object");

  const { commands = [], paths = [] } = raw;

  if (!isLines(commands)) {
    throw new ProjectConfigError("verification.commands must be a list of strings");
  }
  if (!isLines(paths)) throw new ProjectConfigError("verification.paths must be a list of strings");

  return { commands: [...commands], paths: [...paths] };
}

function parseStack(raw: unknown): StackInfo | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) throw new ProjectConfigError("stack must be an object");

  const { languages = [], frameworks = [], packageManager } = raw;

  if (!isLines(languages) || !isLines(frameworks)) {
    throw new ProjectConfigError("stack.languages and stack.frameworks must be lists of strings");
  }

  const stack: StackInfo = { languages: [...languages], frameworks: [...frameworks] };

  if (packageManager === undefined) return stack;
  if (!isLine(packageManager)) {
    throw new ProjectConfigError("stack.packageManager must be a string");
  }

  return { ...stack, packageManager };
}

/**
 * Validates a project config read from a file.
 * @param {unknown} raw Parsed JSON of the config.
 * @returns {ProjectConfig} The validated config; unknown fields are dropped.
 * @throws {ProjectConfigError} If the config does not match the format.
 */
export function parseProjectConfig(raw: unknown): ProjectConfig {
  if (!isObject(raw)) throw new ProjectConfigError("project config must be an object");

  const {
    schemaVersion = PROJECT_CONFIG_SCHEMA_VERSION,
    projectId,
    harness,
    workflow,
    journal,
  } = raw;

  if (schemaVersion !== PROJECT_CONFIG_SCHEMA_VERSION) {
    throw new ProjectConfigError(
      `schemaVersion ${String(schemaVersion)} is not supported: update Cyberzavod (npx cyberzavod@latest sync)`,
    );
  }

  if (!isRecordId(projectId)) {
    throw new ProjectConfigError(
      "projectId must contain only letters, digits, underscores and hyphens",
    );
  }
  if (!isHarnessVersion(harness)) throw new ProjectConfigError("harness must be a string");
  if (!isLine(workflow)) throw new ProjectConfigError("workflow must be a non-empty string");
  if (!isLine(journal)) throw new ProjectConfigError("journal must be a directory path");

  const config: ProjectConfig = {
    projectId,
    harness,
    workflow,
    journal,
    agents: parseAgents(raw.agents),
    verification: parseVerification(raw.verification),
  };
  const stack = parseStack(raw.stack);

  return stack === undefined ? config : { ...config, stack };
}
