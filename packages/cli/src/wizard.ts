// Мастер `init`: показывает найденное в проекте и спрашивает то, что не вывести из файлов, —
// идентификатор, процесс, модели этапов, журнал и проверки. Ответ по умолчанию — найденное.

import { createInterface } from "node:readline";
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
import type { CliMessages } from "./messages/cli-messages.ts";

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

/** Потоки, через которые мастер говорит с человеком. */
export interface TerminalStreams {
  /** Откуда читать ответы. */
  input: NodeJS.ReadableStream;
  /** Куда писать вопросы. */
  output: NodeJS.WritableStream;
}

/**
 * Спрашивает человека в терминале. Ответы читаются построчно из буфера: строка из pipe,
 * пришедшая раньше вопроса, не теряется. Когда ввод заканчивается — закрыт сразу, как
 * в облаке и CI, или ответы кончились раньше вопросов, — на остальные вопросы берётся
 * ответ по умолчанию.
 * @param {TerminalStreams} streams Ввод и вывод мастера.
 * @returns {Prompter} Мастер на заданных потоках.
 */
export function terminalPrompter(streams: TerminalStreams): Prompter {
  const terminal = createInterface({ input: streams.input });
  const lines = terminal[Symbol.asyncIterator]();

  return {
    ask: async (question, fallback) => {
      streams.output.write(`${question} [${fallback}]: `);
      const line = await lines.next();

      // Без ввода терминал не перевёл строку за человека: следующий вопрос ушёл бы в эту же.
      if (line.done === true) {
        streams.output.write("\n");

        return fallback;
      }

      const answer = line.value.trim();

      return answer === "" ? fallback : answer;
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
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {string[]} Строки сводки.
 */
export function describeDetected(
  root: string,
  detected: DetectedProject,
  messages: CliMessages,
): string[] {
  const { wizard } = messages;
  const listed = (values: string[]) =>
    values.length === 0 ? wizard.nothingFound : values.join(", ");

  return [
    wizard.project({ name: detected.name, root }),
    wizard.languages(listed(detected.languages)),
    wizard.frameworks(listed(detected.frameworks)),
    wizard.packageManager(detected.packageManager ?? wizard.packageManagerMissing),
    wizard.git(detected.git),
    wizard.scripts(listed(detected.scripts)),
  ];
}

function splitList(answer: string): string[] {
  const parts = answer.split(LIST_SEPARATOR).map((part) => part.trim());

  return parts.filter((part) => part !== "");
}

interface AgentQuestions {
  harness: Harness;
  stages: Stage[];
  prompter: Prompter;
  messages: CliMessages;
}

async function askAgents(questions: AgentQuestions): Promise<Partial<Record<Stage, AgentConfig>>> {
  const { harness, stages, prompter, messages } = questions;
  const agents: Partial<Record<Stage, AgentConfig>> = {};

  for (const stage of stages) {
    const guide = harness.stages[stage];

    if (guide.role === undefined) continue;

    const question = messages.wizard.modelQuestion({
      title: guide.title,
      agent: DEFAULT_AGENT.agent,
    });
    const model = await prompter.ask(question, DEFAULT_MODEL);

    agents[stage] = { ...DEFAULT_AGENT, model };
  }

  return agents;
}

/** Что нужно мастеру: найденное в проекте, harness, кто отвечает и тексты. */
export interface WizardOptions {
  /** Найденное в проекте. */
  detected: DetectedProject;
  /** Harness: процессы и этапы. */
  harness: Harness;
  /** Кто отвечает на вопросы. */
  prompter: Prompter;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/**
 * Собирает конфиг проекта из найденного и ответов человека.
 * @param {WizardOptions} options Найденное, harness, кто отвечает и сообщения.
 * @returns {Promise<Omit<ProjectConfig, "harness">>} Конфиг без версии harness: её ставит CLI.
 * @throws {HarnessError} Если выбран процесс, которого нет в harness.
 */
export async function askProjectConfig(
  options: WizardOptions,
): Promise<Omit<ProjectConfig, "harness">> {
  const { detected, harness, prompter, messages } = options;
  const { wizard } = messages;
  const projectIdAnswer = await prompter.ask(wizard.projectIdQuestion, projectIdOf(detected.name));
  const workflowName = await prompter.ask(wizard.workflowQuestion, "default");
  const projectId = projectIdOf(projectIdAnswer);
  const workflow = workflowOf(harness, workflowName);
  const agents = await askAgents({ harness, stages: workflow.stages, prompter, messages });
  const journal = await prompter.ask(wizard.journalQuestion, DEFAULT_JOURNAL);
  const commands = await prompter.ask(
    wizard.commandsQuestion(LIST_SEPARATOR),
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
