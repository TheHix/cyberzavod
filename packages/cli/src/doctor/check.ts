// Общие типы проверок `doctor`: результат, проверка машины и проверка проекта.

import type { ClaudeMessages } from "@cyberzavod/adapter-claude";
import type { ProjectAt } from "../commands/project.ts";
import type { Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import type { CredentialsStore } from "../sharing/settings.ts";

/** Разделитель элементов списка в строках проверок. */
export const LIST_SEPARATOR = ", ";

/**
 * Итог одной проверки: прошла (`passed`), не прошла и есть как починить (`failed`) или не ошибка,
 * но человеку стоит знать (`notice`). Код выхода `doctor` зависит только от `failed`.
 */
export type CheckResult =
  | { status: "passed"; summary: string }
  | { status: "failed"; problem: string; fix: string }
  | { status: "notice"; summary: string; hint: string };

/**
 * Проверка прошла.
 * @param {string} summary Что найдено.
 * @returns {CheckResult} Результат `passed`.
 */
export function passed(summary: string): CheckResult {
  return { status: "passed", summary };
}

/**
 * Проверка не прошла.
 * @param {{ problem: string; fix: string }} failure Что не так и что сделать.
 * @param {string} failure.problem Что не так.
 * @param {string} failure.fix Одно действие, которое чинит.
 * @returns {CheckResult} Результат `failed`.
 */
export function failed(failure: { problem: string; fix: string }): CheckResult {
  return { status: "failed", ...failure };
}

/**
 * Пункт, который не ошибка, но о котором человеку стоит знать.
 * @param {{ summary: string; hint: string }} content Что найдено и подсказка.
 * @param {string} content.summary Что найдено.
 * @param {string} content.hint Что можно сделать.
 * @returns {CheckResult} Результат `notice`.
 */
export function notice(content: { summary: string; hint: string }): CheckResult {
  return { status: "notice", ...content };
}

/** Что `doctor` знает о машине, не заглядывая в проект. */
export interface Machine {
  /** Версия Node, на которой запущен CLI, как в `process.versions.node`. */
  nodeVersion: string;
  /** Где лежит токен галереи. */
  credentials: CredentialsStore;
  /** Есть ли программа в `PATH`, без запуска. */
  isProgramAvailable(name: string): Promise<boolean>;
}

/** Результат запуска команды проверки: код выхода или причина, по которой она не стартовала. */
export type CommandRun = { kind: "exited"; code: number } | { kind: "notStarted"; reason: string };

/** Запускает команду оболочкой системы в корне проекта. */
export type CommandRunner = (command: string, root: string) => CommandRun;

/** Всё, что нужно проверкам проекта: сам проект, версия CLI, тексты и работа с программами. */
export interface ProjectContext {
  project: ProjectAt;
  installation: Installation;
  messages: CliMessages;
  claudeMessages: ClaudeMessages;
  /** Есть ли программа: слово с `/` или `\` — файл от `root`, иначе поиск в `PATH`. */
  isProgramAvailable(word: string, root: string): Promise<boolean>;
  runCommand: CommandRunner;
}

/** Проверка машины: не зависит от проекта. */
export interface MachineCheck {
  run(machine: Machine, messages: CliMessages): Promise<CheckResult>;
}

/** Проверка подключённого проекта. */
export interface ProjectCheck {
  run(context: ProjectContext): Promise<CheckResult>;
}
