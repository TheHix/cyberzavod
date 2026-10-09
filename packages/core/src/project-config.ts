// Конфиг проекта — `.cyberzavod/project.json` в его репозитории: маркер «проект подключён»
// и всё, что процессу нужно знать о проекте. Истории в нём нет: записи лежат в журнале.

import { parseAgentConfig, type AgentConfig } from "./agent.ts";
import { isLine, isObject } from "./guards.ts";
import { isHarnessVersion, isRecordId } from "./record.ts";
import { isStage, type Stage } from "./stage.ts";

/**
 * Что считается проверкой проекта: команды запускаются по порядку, все должны пройти.
 * `paths` — каталоги с кодом: правка в них требует проверки; пусто — весь репозиторий.
 */
export interface VerificationConfig {
  commands: string[];
  paths: string[];
}

/**
 * Что найдено в проекте при `init` и `sync`: справка, а не ограничение — стек может смениться,
 * и `sync` найдёт его заново.
 */
export interface StackInfo {
  languages: string[];
  frameworks: string[];
  /** Менеджер пакетов, например `pnpm`; нет, если не найден. */
  packageManager?: string;
}

/** Конфиг проекта, подключённого к Cyberzavod. */
export interface ProjectConfig {
  /** Идентификатор проекта: буквы, цифры, «_» и «-». */
  projectId: string;
  /** Версия harness, по которой созданы файлы адаптеров. */
  harness: string;
  /** Имя процесса из `harness/workflows/`. */
  workflow: string;
  /**
   * Каталог журнала относительно корня проекта, через `/`: `journal` — в репозитории,
   * `../<проект>.cyberzavod` — рядом с ним.
   */
  journal: string;
  /** Агент каждого этапа; этап без агента ведёт адаптер по умолчанию. */
  agents: Partial<Record<Stage, AgentConfig>>;
  verification: VerificationConfig;
  stack?: StackInfo;
}

/**
 * Версия формата `.cyberzavod/project.json`; не путать с версией CLI и harness. Конфиг без поля
 * записан версиями до 0.9.0 и читается как версия 1.
 */
export const PROJECT_CONFIG_SCHEMA_VERSION = 1;

/** Ошибка конфига проекта: файл не прошёл проверку. */
export class ProjectConfigError extends Error {}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLine);
}

function parseAgents(raw: unknown): Partial<Record<Stage, AgentConfig>> {
  if (raw === undefined) return {};
  if (!isObject(raw)) throw new ProjectConfigError("agents должны быть объектом");

  const agents: Partial<Record<Stage, AgentConfig>> = {};

  for (const [stage, agent] of Object.entries(raw)) {
    if (!isStage(stage)) throw new ProjectConfigError(`agents: неизвестный этап ${stage}`);

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
  if (!isObject(raw)) throw new ProjectConfigError("verification должна быть объектом");

  const { commands = [], paths = [] } = raw;

  if (!isLines(commands)) {
    throw new ProjectConfigError("verification.commands должны быть списком строк");
  }
  if (!isLines(paths)) throw new ProjectConfigError("verification.paths должны быть списком строк");

  return { commands: [...commands], paths: [...paths] };
}

function parseStack(raw: unknown): StackInfo | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) throw new ProjectConfigError("stack должен быть объектом");

  const { languages = [], frameworks = [], packageManager } = raw;

  if (!isLines(languages) || !isLines(frameworks)) {
    throw new ProjectConfigError("stack.languages и stack.frameworks должны быть списками строк");
  }

  const stack: StackInfo = { languages: [...languages], frameworks: [...frameworks] };

  if (packageManager === undefined) return stack;
  if (!isLine(packageManager)) throw new ProjectConfigError("stack.packageManager — строка");

  return { ...stack, packageManager };
}

/**
 * Проверяет конфиг проекта, прочитанный из файла.
 * @param {unknown} raw Разобранный JSON конфига.
 * @returns {ProjectConfig} Проверенный конфиг; неизвестные поля отброшены.
 * @throws {ProjectConfigError} Если конфиг не соответствует формату.
 */
export function parseProjectConfig(raw: unknown): ProjectConfig {
  if (!isObject(raw)) throw new ProjectConfigError("конфиг проекта должен быть объектом");

  const {
    schemaVersion = PROJECT_CONFIG_SCHEMA_VERSION,
    projectId,
    harness,
    workflow,
    journal,
  } = raw;

  if (schemaVersion !== PROJECT_CONFIG_SCHEMA_VERSION) {
    throw new ProjectConfigError(
      `schemaVersion ${String(schemaVersion)} не поддерживается: обновите Cyberzavod (npx cyberzavod@latest sync)`,
    );
  }

  if (!isRecordId(projectId)) {
    throw new ProjectConfigError("projectId должен состоять из букв, цифр, «_» и «-»");
  }
  if (!isHarnessVersion(harness)) throw new ProjectConfigError("harness должна быть строкой");
  if (!isLine(workflow)) throw new ProjectConfigError("workflow должен быть непустой строкой");
  if (!isLine(journal)) throw new ProjectConfigError("journal должен быть путём к каталогу");

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
