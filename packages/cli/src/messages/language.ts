// Picking the message language: the `--lang` flag, the `CYBERZAVOD_LANG` variable, the system
// locale, English.

import {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGES,
  isInterfaceLanguage,
  type InterfaceLanguage,
} from "@cyberzavod/core";
import { CommandError } from "../errors.ts";

/** The environment variable the human uses to pick the message language. */
export const LANGUAGE_VARIABLE = "CYBERZAVOD_LANG";

/**
 * Locale variables in descending priority: the first non-empty one sets the system language
 * (POSIX).
 */
export const LOCALE_VARIABLES = ["LC_ALL", "LC_MESSAGES", "LANG"] as const;

const LANGUAGE_FLAG = "--lang";
const INLINE_FLAG_PREFIX = `${LANGUAGE_FLAG}=`;
const ARGUMENTS_END = "--";
const LOCALE_LANGUAGE_END = /[_.@-]/;

/** Process environment: variable names and their values. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** Arguments without the language flag and the flag value, if it was given. */
export interface LanguageFlag {
  /** Value of the last `--lang`; undefined if there is no flag. */
  flag: string | undefined;
  rest: string[];
}

function isFlagValue(token: string | undefined): token is string {
  return token !== undefined && token !== "" && !token.startsWith("-");
}

/** The language flag in the argument list: its value and how many arguments it took. */
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
 * Extracts the `--lang <language>` or `--lang=<language>` flag from anywhere before `--`. On
 * repeats the last one wins; arguments after `--` are left alone.
 * @param {readonly string[]} argv Arguments after the program name.
 * @returns {LanguageFlag} The flag value and the other arguments in their original order.
 * @throws {CommandError} If the flag has no value.
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

/** Where to pick the language from: the command flag and the process environment. */
export interface LanguageSources {
  flag: string | undefined;
  env: Environment;
}

/**
 * Picks the message language: the flag, then `CYBERZAVOD_LANG` (an unsupported value is skipped:
 * a typo in the environment must not crash hooks), then the locale, then English.
 * @param {LanguageSources} sources The `--lang` flag and the environment.
 * @returns {InterfaceLanguage} Message language.
 * @throws {CommandError} If the flag names a language that has no messages.
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
