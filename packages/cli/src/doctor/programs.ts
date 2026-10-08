// Поиск программы без запуска: так `doctor` отличает «программы нет» от «команда упала».

import { access, constants, stat } from "node:fs/promises";
import path from "node:path";
import type { Environment } from "../messages/language.ts";

const PATH_SEPARATOR = /[\\/]/;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s*/;
const QUOTED_WORD = /^(["'])(.*?)\1/;
const PLAIN_WORD = /^\S+/;
const WINDOWS_PATH_DELIMITER = ";";
const POSIX_PATH_DELIMITER = ":";
const DEFAULT_WINDOWS_EXTENSIONS = ".COM;.EXE;.BAT;.CMD";

/** Что искать и где: имя, корень проекта, окружение и платформа. */
export interface ProgramLookup {
  /** Имя в `PATH` или путь с `/` или `\` от корня проекта. */
  name: string;
  root: string;
  env: Environment;
  platform: NodeJS.Platform;
}

/**
 * Программа команды: первое слово после присваиваний переменных (`CI=1 pnpm test` — `pnpm`).
 * @param {string} command Команда проверки целиком.
 * @returns {string | undefined} Первое слово или undefined, если в команде одни присваивания.
 */
export function programOf(command: string): string | undefined {
  let rest = command.trim();

  while (ASSIGNMENT.test(rest)) rest = rest.replace(ASSIGNMENT, "");

  const word = QUOTED_WORD.exec(rest)?.[2] ?? PLAIN_WORD.exec(rest)?.[0];

  return word === "" ? undefined : word;
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function isExecutable(file: string, platform: NodeJS.Platform): Promise<boolean> {
  if (!(await isFile(file))) return false;
  if (platform === "win32") return true;

  try {
    await access(file, constants.X_OK);

    return true;
  } catch {
    return false;
  }
}

function pathDirectories({ env, platform }: ProgramLookup): string[] {
  const isWindows = platform === "win32";
  const value = isWindows ? (env.PATH ?? env.Path) : env.PATH;
  const delimiter = isWindows ? WINDOWS_PATH_DELIMITER : POSIX_PATH_DELIMITER;

  return (value ?? "").split(delimiter).filter((directory) => directory !== "");
}

// На Windows программа находится и под своим именем, и с расширением из PATHEXT.
function fileNames({ name, env, platform }: ProgramLookup): string[] {
  if (platform !== "win32") return [name];

  const extensions = (env.PATHEXT || DEFAULT_WINDOWS_EXTENSIONS)
    .split(WINDOWS_PATH_DELIMITER)
    .filter(Boolean);

  return [name, ...extensions.map((extension) => `${name}${extension}`)];
}

async function firstExecutable(files: string[], platform: NodeJS.Platform): Promise<boolean> {
  for (const file of files) {
    if (await isExecutable(file, platform)) return true;
  }

  return false;
}

/**
 * Есть ли программа: слово с `/` или `\` — файл от корня проекта, иначе поиск в `PATH`; найденное
 * должно быть файлом, на POSIX — исполняемым. Программа не запускается.
 * @param {ProgramLookup} lookup Имя, корень, окружение и платформа.
 * @returns {Promise<boolean>} true, если программа найдена.
 */
export async function isProgramAvailable(lookup: ProgramLookup): Promise<boolean> {
  const { name, root, platform } = lookup;

  if (PATH_SEPARATOR.test(name)) return isExecutable(path.resolve(root, name), platform);

  const files = pathDirectories(lookup).flatMap((directory) =>
    fileNames(lookup).map((fileName) => path.join(directory, fileName)),
  );

  return firstExecutable(files, platform);
}
