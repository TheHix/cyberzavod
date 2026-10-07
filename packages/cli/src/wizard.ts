// Мастер `init`: показывает найденное в проекте и спрашивает то, что не вывести из файлов, —
// идентификатор, процесс, модели этапов, журнал и проверки. Ответ по умолчанию — найденное.

import { createInterface } from "node:readline/promises";
import path from "node:path";
import {
  DEFAULT_MODEL,
  type AgentConfig,
  type Harness,
  type HarnessError,
  type ProjectConfig,
  type Stage,
} from "@cyberzavod/core";
import { DEFAULT_JOURNAL, workflowOf } from "@cyberzavod/storage";
import { projectIdOf, stackOf, type DetectedProject } from "./detect.ts";

/** Кто отвечает на вопросы мастера: человек в терминале или значения по умолчанию. */
export interface Prompter {
  /**
   * Задаёт вопрос.
   * @param {string} question Вопрос.
   * @param {string} fallback Ответ по умолчанию: его берёт пустой ввод.
   * @returns {Promise<string>} Ответ.
   */
  ask(question: string, fallback: string): Promise<string>;
  /** Освобождает терминал. */
  close(): void;
}

/** Агент, которого сейчас умеет вести Cyberzavod. */
export const DEFAULT_AGENT: Required<Omit<AgentConfig, "model">> = {
  provider: "anthropic",
  agent: "claude",
};

const LIST_SEPARATOR = ";";

/**
 * Отвечает на все вопросы значениями по умолчанию: `init --yes`.
 * @returns {Prompter} Мастер без вопросов.
 */
export function defaultsPrompter(): Prompter {
  return { ask: (_question, fallback) => Promise.resolve(fallback), close: () => undefined };
}

/**
 * Спрашивает человека в терминале.
 * @returns {Prompter} Мастер на stdin и stdout.
 */
export function terminalPrompter(): Prompter {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });

  return {
    ask: async (question, fallback) => {
      const answer = await terminal.question(`${question} [${fallback}]: `);
      const trimmed = answer.trim();

      return trimmed === "" ? fallback : trimmed;
    },
    close: () => {
      terminal.close();
    },
  };
}

/**
 * Описывает найденное в проекте для человека.
 * @param {string} root Корень проекта.
 * @param {DetectedProject} detected Найденное.
 * @returns {string[]} Строки сводки.
 */
export function describeDetected(root: string, detected: DetectedProject): string[] {
  const listed = (values: string[]) => (values.length === 0 ? "не найдены" : values.join(", "));

  return [
    `Проект: ${detected.name} (${root})`,
    `Языки: ${listed(detected.languages)}`,
    `Фреймворки: ${listed(detected.frameworks)}`,
    `Менеджер пакетов: ${detected.packageManager ?? "не найден"}`,
    `Git: ${detected.git ? "есть" : "нет"}`,
    `Скрипты: ${listed(detected.scripts)}`,
  ];
}

function splitList(answer: string): string[] {
  const parts = answer.split(LIST_SEPARATOR).map((part) => part.trim());

  return parts.filter((part) => part !== "");
}

async function askAgents(
  harness: Harness,
  stages: Stage[],
  prompter: Prompter,
): Promise<Partial<Record<Stage, AgentConfig>>> {
  const agents: Partial<Record<Stage, AgentConfig>> = {};

  for (const stage of stages) {
    const guide = harness.stages[stage];

    if (guide.role === undefined) continue;

    const model = await prompter.ask(
      `Модель этапа «${guide.title}» (агент ${DEFAULT_AGENT.agent})`,
      DEFAULT_MODEL,
    );

    agents[stage] = { ...DEFAULT_AGENT, model };
  }

  return agents;
}

/**
 * Собирает конфиг проекта из найденного и ответов человека.
 * @param {DetectedProject} detected Найденное в проекте.
 * @param {Harness} harness Harness: процессы и этапы.
 * @param {Prompter} prompter Кто отвечает на вопросы.
 * @returns {Promise<Omit<ProjectConfig, "harness">>} Конфиг без версии harness: её ставит CLI.
 * @throws {HarnessError} Если выбран процесс, которого нет в harness.
 */
export async function askProjectConfig(
  detected: DetectedProject,
  harness: Harness,
  prompter: Prompter,
): Promise<Omit<ProjectConfig, "harness">> {
  const projectIdAnswer = await prompter.ask("Идентификатор проекта", projectIdOf(detected.name));
  const workflowName = await prompter.ask("Процесс", "default");
  const projectId = projectIdOf(projectIdAnswer);
  const workflow = workflowOf(harness, workflowName);
  const agents = await askAgents(harness, workflow.stages, prompter);
  const journal = await prompter.ask("Каталог журнала от корня проекта", DEFAULT_JOURNAL);
  const commands = await prompter.ask(
    `Команды проверки через «${LIST_SEPARATOR}»`,
    detected.verification.join(`${LIST_SEPARATOR} `),
  );

  return {
    projectId,
    workflow: workflow.name,
    journal: journal.split(path.sep).join("/"),
    agents,
    verification: { commands: splitList(commands), paths: [] },
    stack: stackOf(detected),
  };
}
