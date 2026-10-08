// Разбор командной строки: имя команды выбирает обработчик из таблицы, обработчик получает
// аргументы и каталог, из которого запущен CLI, и возвращает код выхода.

import { homedir, tmpdir } from "node:os";
import { parseArgs } from "node:util";
import {
  CLAUDE_MESSAGES,
  ClaudeError,
  draftSession,
  isHookName,
  publishSessions,
  runHook,
  type ClaudeMessages,
} from "@cyberzavod/adapter-claude";
import { RecordError, type InterfaceLanguage, type LocalizedText } from "@cyberzavod/core";
import { JournalError, ProjectFileError } from "@cyberzavod/storage";
import { galleryAccessOf, showGallery } from "./commands/gallery.ts";
import { initProject } from "./commands/init.ts";
import { recordDecision, recordNote } from "./commands/journal.ts";
import { login, logout } from "./commands/login.ts";
import { shareRecording, unshareRecording } from "./commands/share.ts";
import { printStatus } from "./commands/status.ts";
import { checkProject, syncProject } from "./commands/sync.ts";
import { closestName } from "./closest-name.ts";
import { confirmWithoutAsking, terminalConfirmation } from "./confirmation.ts";
import { CommandError } from "./errors.ts";
import { commandHelp, generalHelp, listedCommandNames, type CommandPlacement } from "./help.ts";
import type { InitOverrides } from "./initial-config.ts";
import { readInstallation } from "./installation/installation.ts";
import { CLI_MESSAGES } from "./messages/catalog.ts";
import { COMMAND_NAMES, type CliMessages, type CommandName } from "./messages/cli-messages.ts";
import { extractLanguageFlag, languageOf, type Environment } from "./messages/language.ts";
import { ApiError } from "./sharing/api.ts";
import { createSharing, type Sharing } from "./sharing/services.ts";

const SUCCESS = 0;
const FAILURE = 1;
const GENERAL_HELP_REQUESTS: readonly string[] = ["help", "--help", "-h"];
const COMMAND_HELP_FLAGS: readonly string[] = ["--help", "-h"];
const OPTIONS_END = "--";

/**
 * Как запущена команда: её аргументы, каталог, из которого её вызвали, окружение и тексты на
 * выбранном языке.
 */
interface Invocation {
  args: string[];
  directory: string;
  env: Environment;
  messages: CliMessages;
  claudeMessages: ClaudeMessages;
}

// Справка команды лежит в каталоге сообщений: команда без справки не компилируется. Раздел —
// место команды в общей справке; служебные команды (`service`) в списке не показываются.
interface Command {
  section: CommandPlacement;
  run(invocation: Invocation): Promise<number>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);

  return Buffer.concat(chunks).toString("utf8");
}

function requiredText(value: string | undefined, missing: LocalizedText<CliMessages>): string {
  if (value === undefined || value.trim() === "") throw new CommandError(missing);

  return value;
}

function defaultSharing(env: Environment): Sharing {
  return createSharing({ env, platform: process.platform, homeDirectory: homedir() });
}

interface InitFlags {
  id?: string | undefined;
  check?: string[] | undefined;
  journal?: string | undefined;
}

function initOverridesOf(flags: InitFlags): InitOverrides {
  return {
    ...(flags.id === undefined ? {} : { projectId: flags.id }),
    ...(flags.check === undefined ? {} : { checks: flags.check }),
    ...(flags.journal === undefined ? {} : { journal: flags.journal }),
  };
}

const COMMANDS: Readonly<Record<CommandName, Command>> = {
  init: {
    section: "start",
    run: async ({ args, directory, messages }) => {
      const { values } = parseArgs({
        args,
        options: {
          yes: { type: "boolean", short: "y" },
          id: { type: "string" },
          check: { type: "string", multiple: true },
          journal: { type: "string" },
        },
      });
      const canAsk = values.yes !== true && process.stdin.isTTY === true;
      const confirm = canAsk
        ? terminalConfirmation({ input: process.stdin, output: process.stdout })
        : confirmWithoutAsking;

      await initProject(directory, {
        confirm,
        overrides: initOverridesOf(values),
        installation: await readInstallation(),
        messages,
      });

      return SUCCESS;
    },
  },
  sync: {
    section: "maintenance",
    run: async ({ args, directory, messages }) => {
      const { values } = parseArgs({
        args,
        options: { check: { type: "boolean" }, force: { type: "boolean" } },
      });
      const installation = await readInstallation();

      if (values.check === true) {
        const isUpToDate = await checkProject(directory, installation, messages);

        return isUpToDate ? SUCCESS : FAILURE;
      }

      await syncProject(directory, { force: values.force === true, installation, messages });

      return SUCCESS;
    },
  },
  status: {
    section: "start",
    run: async ({ directory, messages }) => {
      await printStatus(directory, await readInstallation(), messages);

      return SUCCESS;
    },
  },
  decision: {
    section: "journal",
    run: async ({ args, directory, messages }) => {
      const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        options: { why: { type: "string" } },
      });

      const title = requiredText(positionals.join(" "), (m) => m.errors.missingDecisionText);

      await recordDecision({ directory, title, description: values.why ?? "", messages });

      return SUCCESS;
    },
  },
  note: {
    section: "journal",
    run: async ({ args, directory, messages }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });

      const text = requiredText(positionals.join(" "), (m) => m.errors.missingNoteText);

      await recordNote(directory, text, messages);

      return SUCCESS;
    },
  },
  draft: {
    section: "service",
    run: async ({ args, directory, claudeMessages }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [rawPath] = positionals;

      await draftSession({
        projectDirectory: directory,
        messages: claudeMessages,
        ...(rawPath === undefined ? {} : { rawPath }),
      });

      return SUCCESS;
    },
  },
  publish: {
    section: "service",
    run: async ({ args, directory, claudeMessages }) => {
      const { values } = parseArgs({
        args,
        options: { draft: { type: "string" }, build: { type: "string" } },
      });
      const published = await publishSessions({
        projectDirectory: directory,
        messages: claudeMessages,
        ...(values.draft === undefined ? {} : { draftPath: values.draft }),
        ...(values.build === undefined ? {} : { buildId: values.build }),
      });

      return published ? SUCCESS : FAILURE;
    },
  },
  login: {
    section: "gallery",
    run: async ({ env, messages }) => {
      await login(defaultSharing(env), messages);

      return SUCCESS;
    },
  },
  logout: {
    section: "gallery",
    run: async ({ env, messages }) => {
      await logout(defaultSharing(env), messages);

      return SUCCESS;
    },
  },
  share: {
    section: "gallery",
    run: async ({ args, directory, env, messages }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [id] = positionals;

      const recordId = requiredText(id, (m) => m.errors.missingRecordId);

      await shareRecording(defaultSharing(env), { directory, id: recordId, messages });

      return SUCCESS;
    },
  },
  unshare: {
    section: "gallery",
    run: async ({ args, env, messages }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [id] = positionals;

      const recordId = requiredText(id, (m) => m.errors.missingRecordId);

      await unshareRecording(defaultSharing(env), recordId, messages);

      return SUCCESS;
    },
  },
  gallery: {
    section: "gallery",
    run: async ({ args, env, messages }) => {
      const { values } = parseArgs({
        args,
        options: { public: { type: "boolean" }, private: { type: "boolean" } },
      });
      const access = galleryAccessOf(values.public === true, values.private === true);

      await showGallery(defaultSharing(env), access, messages);

      return SUCCESS;
    },
  },
  hook: {
    section: "service",
    run: async ({ args, directory, env, claudeMessages }) => {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [name = ""] = positionals;

      if (!isHookName(name)) throw new CommandError((m) => m.errors.unknownHook(name));

      const payload = await readStdin();
      const outcome = await runHook(name, {
        payload,
        projectDirectory: env.CLAUDE_PROJECT_DIR || directory,
        tmpDir: tmpdir(),
        messages: claudeMessages,
      });

      process.stdout.write(outcome.stdout);
      process.stderr.write(outcome.stderr);

      return outcome.exitCode;
    },
  },
};

const EXPECTED_ERRORS = [
  CommandError,
  ApiError,
  ClaudeError,
  ProjectFileError,
  JournalError,
  RecordError,
];
const ARGUMENT_ERROR_PREFIX = "ERR_PARSE_ARGS";

// Ошибки, которые человек исправляет сам: им хватает сообщения. Неверные аргументы parseArgs
// сообщает ошибкой с кодом ERR_PARSE_ARGS_*.
function isExpected(err: unknown): err is Error {
  if (EXPECTED_ERRORS.some((kind) => err instanceof kind)) return true;

  const code = err instanceof Error && "code" in err ? err.code : undefined;

  return typeof code === "string" && code.startsWith(ARGUMENT_ERROR_PREFIX);
}

// Ошибки с текстом по каталогу печатаются на выбранном языке; остальные — как есть: тексты
// сервера и диагностика формата файлов не переводятся.
function expectedErrorText(
  err: Error,
  messages: CliMessages,
  claudeMessages: ClaudeMessages,
): string {
  if (err instanceof CommandError) return err.describe(messages);
  if (err instanceof ClaudeError) return err.describe(claudeMessages);

  return err.message;
}

function isCommandName(name: string): name is CommandName {
  return (COMMAND_NAMES as readonly string[]).includes(name);
}

function hasHelpFlag(args: readonly string[]): boolean {
  const optionEnd = args.indexOf(OPTIONS_END);
  const options = optionEnd === -1 ? args : args.slice(0, optionEnd);

  return options.some((argument) => COMMAND_HELP_FLAGS.includes(argument));
}

// Служебные команды не подсказываются: человек их не набирает.
function printUnknownCommand(name: string, messages: CliMessages): number {
  const suggestion = closestName(name, listedCommandNames(COMMANDS));
  const text =
    suggestion === undefined
      ? messages.errors.unknownCommand(name)
      : messages.errors.unknownCommandWithSuggestion({ name, suggestion });

  console.error(`cyberzavod: ${text}`);

  return FAILURE;
}

/** Выбранный язык и аргументы без флага `--lang`. */
interface LanguageChoice {
  language: InterfaceLanguage;
  rest: string[];
}

// Ошибка флага языка возвращается, а не бросается: печатать её приходится на языке без флага.
function chooseLanguage(argv: string[], env: Environment): LanguageChoice | CommandError {
  try {
    const { flag, rest } = extractLanguageFlag(argv);

    return { language: languageOf({ flag, env }), rest };
  } catch (err) {
    if (err instanceof CommandError) return err;

    throw err;
  }
}

function printLanguageError(err: CommandError, env: Environment): number {
  const messages = CLI_MESSAGES[languageOf({ flag: undefined, env })];

  console.error(`cyberzavod: ${err.describe(messages)}`);

  return FAILURE;
}

/**
 * Выполняет команду CLI.
 * @param {string[]} argv Аргументы после имени программы.
 * @param {string} directory Каталог, из которого запущен CLI.
 * @param {Environment} env Окружение процесса: язык сообщений, адрес сервера, каталог проекта хука.
 * @returns {Promise<number>} Код выхода.
 */
export async function runCli(argv: string[], directory: string, env: Environment): Promise<number> {
  const choice = chooseLanguage(argv, env);

  if (choice instanceof CommandError) return printLanguageError(choice, env);

  const messages = CLI_MESSAGES[choice.language];
  const claudeMessages = CLAUDE_MESSAGES[choice.language];
  const [name, ...args] = choice.rest;

  if (name === undefined || GENERAL_HELP_REQUESTS.includes(name)) {
    console.log(generalHelp(messages, COMMANDS));

    return SUCCESS;
  }

  if (!isCommandName(name)) return printUnknownCommand(name, messages);

  if (hasHelpFlag(args)) {
    console.log(commandHelp(name, messages));

    return SUCCESS;
  }

  try {
    return await COMMANDS[name].run({ args, directory, env, messages, claudeMessages });
  } catch (err) {
    if (!isExpected(err)) throw err;

    console.error(`cyberzavod ${name}: ${expectedErrorText(err, messages, claudeMessages)}`);

    return FAILURE;
  }
}
