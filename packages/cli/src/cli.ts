// Разбор командной строки: имя команды выбирает обработчик из таблицы, обработчик получает
// аргументы и каталог, из которого запущен CLI, и возвращает код выхода.

import { parseArgs } from "node:util";
import { draftSession, GenerateError, publishSessions } from "@cyberzavod/adapter-claude";
import { RecordError } from "@cyberzavod/core";
import { JournalError, ProjectFileError } from "@cyberzavod/storage";
import { initProject } from "./commands/init.ts";
import { recordDecision, recordNote } from "./commands/journal.ts";
import { printStatus } from "./commands/status.ts";
import { syncProject } from "./commands/sync.ts";
import { CommandError } from "./errors.ts";
import { defaultsPrompter, terminalPrompter } from "./wizard.ts";

const SUCCESS = 0;
const FAILURE = 1;

/** Как запущена команда: её аргументы и каталог, из которого её вызвали. */
interface Invocation {
  args: string[];
  directory: string;
}

interface Command {
  usage: string;
  summary: string;
  run(invocation: Invocation): Promise<number>;
}

function requiredText(value: string | undefined, what: string): string {
  if (value === undefined || value.trim() === "") throw new CommandError(`нужен ${what}`);
  return value;
}

const COMMANDS: Readonly<Record<string, Command>> = {
  init: {
    usage: "init [--yes]",
    summary: "подключить проект в текущем каталоге: мастер, конфиг, AGENTS.md, файлы агента",
    run: async ({ args, directory }) => {
      const { values } = parseArgs({ args, options: { yes: { type: "boolean", short: "y" } } });
      const prompter = values.yes === true ? defaultsPrompter() : terminalPrompter();
      try {
        await initProject(directory, prompter);
      } finally {
        prompter.close();
      }
      return SUCCESS;
    },
  },
  sync: {
    usage: "sync [--check] [--force]",
    summary: "заново найти стек и пересобрать файлы агента; --check — только проверить",
    run: async ({ args, directory }) => {
      const { values } = parseArgs({
        args,
        options: { check: { type: "boolean" }, force: { type: "boolean" } },
      });
      const options = { check: values.check === true, force: values.force === true };
      return (await syncProject(directory, options)) ? SUCCESS : FAILURE;
    },
  },
  status: {
    usage: "status",
    summary: "проект, процесс, агенты этапов, проверки и журнал",
    run: async ({ directory }) => {
      await printStatus(directory);
      return SUCCESS;
    },
  },
  decision: {
    usage: 'decision "<что решили>" [--why "<почему>"]',
    summary: "записать решение в журнал",
    run: async ({ args, directory }) => {
      const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        options: { why: { type: "string" } },
      });
      await recordDecision(
        directory,
        requiredText(positionals.join(" "), "текст решения"),
        values.why ?? "",
      );
      return SUCCESS;
    },
  },
  note: {
    usage: 'note "<текст>"',
    summary: "записать заметку в журнал",
    run: async ({ args, directory }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      await recordNote(directory, requiredText(positionals.join(" "), "текст заметки"));
      return SUCCESS;
    },
  },
  draft: {
    usage: "draft [<сырой журнал сессии>]",
    summary: "собрать черновик записи из журнала сессии Claude Code",
    run: async ({ args, directory }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [rawPath] = positionals;
      await draftSession({
        projectDirectory: directory,
        ...(rawPath === undefined ? {} : { rawPath }),
      });
      return SUCCESS;
    },
  },
  publish: {
    usage: "publish [--draft <черновик>] [--build <id сборки>]",
    summary: "опубликовать отредактированный черновик записями в журнал",
    run: async ({ args, directory }) => {
      const { values } = parseArgs({
        args,
        options: { draft: { type: "string" }, build: { type: "string" } },
      });
      const published = await publishSessions({
        projectDirectory: directory,
        ...(values.draft === undefined ? {} : { draftPath: values.draft }),
        ...(values.build === undefined ? {} : { buildId: values.build }),
      });
      return published ? SUCCESS : FAILURE;
    },
  },
};

/**
 * Текст справки: команды и что они делают.
 * @returns {string} Справка.
 */
export function usage(): string {
  const lines = Object.values(COMMANDS).map(
    (command) => `  cyberzavod ${command.usage}\n      ${command.summary}`,
  );
  return `Cyberzavod — процесс разработки с ИИ-агентами, локально.\n\n${lines.join("\n")}`;
}

const EXPECTED_ERRORS = [CommandError, GenerateError, ProjectFileError, JournalError, RecordError];
const ARGUMENT_ERROR_PREFIX = "ERR_PARSE_ARGS";

// Ошибки, которые человек исправляет сам: им хватает сообщения. Неверные аргументы parseArgs
// сообщает ошибкой с кодом ERR_PARSE_ARGS_*.
function isExpected(err: unknown): err is Error {
  if (EXPECTED_ERRORS.some((kind) => err instanceof kind)) return true;
  const code = err instanceof Error && "code" in err ? err.code : undefined;
  return typeof code === "string" && code.startsWith(ARGUMENT_ERROR_PREFIX);
}

/**
 * Выполняет команду CLI.
 * @param {string[]} argv Аргументы после имени программы.
 * @param {string} directory Каталог, из которого запущен CLI.
 * @returns {Promise<number>} Код выхода.
 */
export async function runCli(argv: string[], directory: string): Promise<number> {
  const [name, ...args] = argv;
  const command = name === undefined ? undefined : COMMANDS[name];
  if (command === undefined) {
    console.log(usage());
    return name === undefined || name === "help" || name === "--help" ? SUCCESS : FAILURE;
  }
  try {
    return await command.run({ args, directory });
  } catch (err) {
    if (!isExpected(err)) throw err;
    console.error(`cyberzavod ${name}: ${err.message}`);
    return FAILURE;
  }
}
