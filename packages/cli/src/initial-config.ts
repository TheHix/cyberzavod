// Конфиг проекта, с которым `init` подключает проект: найденное в проекте, процесс и агенты
// по умолчанию, поверх них — флаги человека.

import path from "node:path";
import {
  DEFAULT_MODEL,
  type AgentConfig,
  type Harness,
  type ProjectConfig,
  type Stage,
} from "@cyberzavod/core";
import { DEFAULT_JOURNAL, workflowOf } from "@cyberzavod/storage";
import { projectIdOf, stackOf, type DetectedProject } from "./detect.ts";
import { HARNESS_VERSION } from "./installation/installation.ts";
import { CommandError } from "./errors.ts";

/** Агент, которого сейчас умеет вести Cyberzavod. */
export const DEFAULT_AGENT: Required<Omit<AgentConfig, "model">> = {
  provider: "anthropic",
  agent: "claude",
};

/** Процесс, который `init` ставит проекту. */
export const DEFAULT_WORKFLOW = "default";

const PROJECT_ID_OPTION = "--id";
const CHECK_OPTION = "--check";
const JOURNAL_OPTION = "--journal";
const POSIX_SEPARATOR = "/";
const CURRENT_DIRECTORY = ".";
const WINDOWS_SEPARATOR = "\\";
const TRAILING_SEPARATORS = /\/+$/;

/** Значения флагов `init`: что человек задал сам вместо найденного. */
export interface InitOverrides {
  /** `--id`: идентификатор проекта. */
  projectId?: string;
  /** `--check`: команды проверки; целиком заменяют найденные. */
  checks?: string[];
  /** `--journal`: каталог журнала от корня проекта. */
  journal?: string;
}

/** Что нужно для начального конфига: найденное, harness и флаги. */
export interface InitialConfigSource {
  /** Найденное в проекте. */
  detected: DetectedProject;
  /** Harness: процессы и этапы. */
  harness: Harness;
  /** Флаги человека. */
  overrides: InitOverrides;
}

function requiredValue(option: string, value: string): string {
  const trimmed = value.trim();

  if (trimmed === "") throw new CommandError((m) => m.errors.blankOption(option));

  return trimmed;
}

function projectIdOption(value: string): string {
  return projectIdOf(requiredValue(PROJECT_ID_OPTION, value));
}

function checksOption(values: readonly string[]): string[] {
  return values.map((value) => requiredValue(CHECK_OPTION, value));
}

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

// Журнал в конфиге — путь от корня проекта через `/`: обратная косая черта Windows и
// косая черта в конце (`./lab/`) в него не попадают.
function journalOption(value: string): string {
  const journal = requiredValue(JOURNAL_OPTION, value);

  if (isAbsolutePath(journal)) throw new CommandError((m) => m.errors.absoluteJournal(journal));

  const slashed = journal.split(WINDOWS_SEPARATOR).join(POSIX_SEPARATOR);
  const normalized = path.posix.normalize(slashed);
  const relative = normalized.replace(TRAILING_SEPARATORS, "");

  // Журнал в корне проекта засорил бы его: каталог журнала должен быть своим.
  if (relative === CURRENT_DIRECTORY) {
    throw new CommandError((m) => m.errors.journalIsProjectRoot(journal));
  }

  return relative;
}

// Агента получает каждый этап процесса, у которого в harness есть роль.
function agentsOf(harness: Harness, stages: readonly Stage[]): Partial<Record<Stage, AgentConfig>> {
  const agents: Partial<Record<Stage, AgentConfig>> = {};

  for (const stage of stages) {
    if (harness.stages[stage].role === undefined) continue;

    agents[stage] = { ...DEFAULT_AGENT, model: DEFAULT_MODEL };
  }

  return agents;
}

/**
 * Собирает конфиг проекта из найденного: идентификатор, проверки и стек из проекта, процесс
 * `default` и агент на каждый этап с ролью. Флаги человека перекрывают найденное.
 * @param {InitialConfigSource} source Найденное в проекте, harness и флаги.
 * @returns {ProjectConfig} Конфиг проекта с версией harness этого CLI.
 * @throws {CommandError} Если флаг пуст или `--journal` задан абсолютным путём.
 */
export function initialConfigOf(source: InitialConfigSource): ProjectConfig {
  const { detected, harness, overrides } = source;
  const projectId =
    overrides.projectId === undefined
      ? projectIdOf(detected.name)
      : projectIdOption(overrides.projectId);
  const commands =
    overrides.checks === undefined ? detected.verification : checksOption(overrides.checks);
  const journal =
    overrides.journal === undefined ? DEFAULT_JOURNAL : journalOption(overrides.journal);
  const workflow = workflowOf(harness, DEFAULT_WORKFLOW);

  return {
    projectId,
    harness: HARNESS_VERSION,
    workflow: workflow.name,
    journal,
    agents: agentsOf(harness, workflow.stages),
    verification: { commands, paths: [] },
    stack: stackOf(detected),
  };
}
