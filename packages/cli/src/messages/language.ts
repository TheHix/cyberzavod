// Выбор языка сообщений: флаг `--lang`, переменная `CYBERZAVOD_LANG`, локаль системы, английский.

import {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGES,
  isInterfaceLanguage,
  type InterfaceLanguage,
} from "@cyberzavod/core";
import { CommandError } from "../errors.ts";

/** Переменная окружения, которой человек выбирает язык сообщений. */
export const LANGUAGE_VARIABLE = "CYBERZAVOD_LANG";

/** Переменные локали по убыванию приоритета: первая непустая задаёт язык системы (POSIX). */
export const LOCALE_VARIABLES = ["LC_ALL", "LC_MESSAGES", "LANG"] as const;

const LANGUAGE_FLAG = "--lang";
const INLINE_FLAG_PREFIX = `${LANGUAGE_FLAG}=`;
const ARGUMENTS_END = "--";
const LOCALE_LANGUAGE_END = /[_.@-]/;

/** Окружение процесса: имена переменных и их значения. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** Аргументы без флага языка и значение флага, если он был. */
export interface LanguageFlag {
  /** Значение последнего `--lang`; undefined, если флага нет. */
  flag: string | undefined;
  rest: string[];
}

function isFlagValue(token: string | undefined): token is string {
  return token !== undefined && token !== "" && !token.startsWith("-");
}

/** Флаг языка в списке аргументов: его значение и сколько аргументов он занял. */
interface FlagMatch {
  value: string | undefined;
  length: number;
}

function flagAt(tokens: readonly string[], index: number): FlagMatch | undefined {
  const token = tokens[index] as string;

  if (token === LANGUAGE_FLAG) return { value: tokens[index + 1], length: 2 };
  if (!token.startsWith(INLINE_FLAG_PREFIX)) return undefined;

  return { value: token.slice(INLINE_FLAG_PREFIX.length), length: 1 };
}

/**
 * Вынимает флаг `--lang <язык>` или `--lang=<язык>` из любого места до `--`. Повтор — побеждает
 * последний; аргументы после `--` не трогаются.
 * @param {readonly string[]} argv Аргументы после имени программы.
 * @returns {LanguageFlag} Значение флага и остальные аргументы в прежнем порядке.
 * @throws {CommandError} Если у флага нет значения.
 */
export function extractLanguageFlag(argv: readonly string[]): LanguageFlag {
  const argumentsEnd = argv.indexOf(ARGUMENTS_END);
  const optionsLength = argumentsEnd === -1 ? argv.length : argumentsEnd;
  const rest: string[] = [];
  let flag: string | undefined;
  let index = 0;

  while (index < optionsLength) {
    const match = flagAt(argv, index);

    if (match === undefined) {
      rest.push(argv[index] as string);
      index++;

      continue;
    }

    if (!isFlagValue(match.value)) {
      throw new CommandError((messages) => messages.errors.languageFlagWithoutValue);
    }

    flag = match.value;
    index += match.length;
  }

  return { flag, rest: [...rest, ...argv.slice(optionsLength)] };
}

function localeLanguageOf(env: Environment): InterfaceLanguage {
  const values = LOCALE_VARIABLES.map((name) => env[name]);
  const locale = values.find((value) => value !== undefined && value !== "") ?? "";
  const [code = ""] = locale.split(LOCALE_LANGUAGE_END);

  return isInterfaceLanguage(code) ? code : DEFAULT_INTERFACE_LANGUAGE;
}

/** Откуда выбирать язык: флаг команды и окружение процесса. */
export interface LanguageSources {
  flag: string | undefined;
  env: Environment;
}

/**
 * Выбирает язык сообщений: флаг, затем `CYBERZAVOD_LANG` (неподдерживаемое значение
 * пропускается: опечатка в окружении не должна ронять хуки), затем локаль, затем английский.
 * @param {LanguageSources} sources Флаг `--lang` и окружение.
 * @returns {InterfaceLanguage} Язык сообщений.
 * @throws {CommandError} Если во флаге язык, на котором нет сообщений.
 */
export function languageOf({ flag, env }: LanguageSources): InterfaceLanguage {
  if (flag !== undefined) {
    if (isInterfaceLanguage(flag)) return flag;

    throw new CommandError((messages) =>
      messages.errors.unsupportedLanguage({
        value: flag,
        supported: INTERFACE_LANGUAGES.join(", "),
      }),
    );
  }

  const fromVariable = env[LANGUAGE_VARIABLE];

  if (fromVariable !== undefined && isInterfaceLanguage(fromVariable)) return fromVariable;

  return localeLanguageOf(env);
}
