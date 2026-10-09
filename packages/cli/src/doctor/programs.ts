// Program lookup without running it: this is how `doctor` tells "no program" from "command failed".

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

/** What to look for and where: name, project root, environment and platform. */
export interface ProgramLookup {
  /** A name in `PATH` or a path with `/` or `\` from the project root. */
  name: string;
  root: string;
  env: Environment;
  platform: NodeJS.Platform;
}

/**
 * The command's program: the first word after variable assignments (`CI=1 pnpm test` → `pnpm`).
 * @param {string} command The whole check command.
 * @returns {string | undefined} The first word, or undefined if the command has only assignments.
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

// On Windows a program is found both under its own name and with an extension from PATHEXT.
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
 * Whether the program exists: a word with `/` or `\` is a file from the project root, otherwise a
 * `PATH` lookup; what is found must be a file, executable on POSIX. The program is not run.
 * @param {ProgramLookup} lookup Name, root, environment and platform.
 * @returns {Promise<boolean>} true if the program is found.
 */
export async function isProgramAvailable(lookup: ProgramLookup): Promise<boolean> {
  const { name, root, platform } = lookup;

  if (PATH_SEPARATOR.test(name)) return isExecutable(path.resolve(root, name), platform);

  const files = pathDirectories(lookup).flatMap((directory) =>
    fileNames(lookup).map((fileName) => path.join(directory, fileName)),
  );

  return firstExecutable(files, platform);
}
