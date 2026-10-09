// Маркер проекта на диске: `.cyberzavod/project.json` в корне репозитория. По нему CLI,
// адаптеры и хуки находят проект и его журнал.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseProjectConfig,
  PROJECT_CONFIG_SCHEMA_VERSION,
  type ProjectConfig,
} from "@cyberzavod/core";

/** Каталог маркера относительно корня проекта. */
export const MARKER_DIRECTORY = ".cyberzavod";

/** Путь конфига проекта относительно его корня. */
export const PROJECT_CONFIG_FILE = path.join(MARKER_DIRECTORY, "project.json");

/**
 * Собранный CLI внутри проекта до версии 0.8.0, от корня через `/`: туда клали файл, который
 * запускали хуки. Теперь хуки идут через npx, `sync` этот файл удаляет, а адаптер по нему
 * узнаёт хуки прежних версий.
 */
export const LEGACY_TOOL_FILE = `${MARKER_DIRECTORY}/bin/cyberzavod.mjs`;

/** Журнал проекта по умолчанию, от корня через `/`: рядом с конфигом, в репозитории проекта. */
export const DEFAULT_JOURNAL = `${MARKER_DIRECTORY}/journal`;

/** Ошибка чтения конфига проекта: файл есть, но не читается или не прошёл проверку. */
export class ProjectFileError extends Error {}

const FILE_NOT_FOUND = "ENOENT";
const NOT_A_DIRECTORY = "ENOTDIR";

function hasErrorCode(err: unknown, code: string): boolean {
  return err instanceof Error && "code" in err && err.code === code;
}

/**
 * Отличает «файла нет» от остальных ошибок файловой системы.
 * @param {unknown} err Ошибка из node:fs.
 * @returns {boolean} true, если файла или каталога нет.
 */
export function isNotFound(err: unknown): boolean {
  return hasErrorCode(err, FILE_NOT_FOUND);
}

// Путь может вести сквозь файл (ENOTDIR): для поиска маркера это тоже «нет».
function isMissing(err: unknown): boolean {
  return isNotFound(err) || hasErrorCode(err, NOT_A_DIRECTORY);
}

/**
 * Читает конфиг проекта из его корня.
 * @param {string} root Корень проекта.
 * @returns {Promise<ProjectConfig | undefined>} Конфиг или undefined, если маркера нет.
 * @throws {ProjectFileError} Если файл есть, но это не JSON или он не прошёл проверку.
 */
export async function readProjectConfig(root: string): Promise<ProjectConfig | undefined> {
  const configPath = path.join(root, PROJECT_CONFIG_FILE);
  let text: string;

  try {
    text = await readFile(configPath, "utf8");
  } catch (err) {
    if (isMissing(err)) return undefined;

    throw new ProjectFileError(`${configPath} cannot be read`, { cause: err });
  }

  try {
    return parseProjectConfig(JSON.parse(text));
  } catch (err) {
    throw new ProjectFileError(`${configPath}: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * Находит проект каталога: поднимается от него вверх до первого маркера.
 * @param {string} directory Каталог, с которого начинается поиск.
 * @returns {Promise<string | undefined>} Корень проекта или undefined, если маркера нет до корня
 *   диска.
 * @throws {Error} Если путь не читается по другой причине, чем «нет файла».
 */
export async function findProjectRoot(directory: string): Promise<string | undefined> {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    if (await isFile(path.join(current, PROJECT_CONFIG_FILE))) return current;
    if (path.dirname(current) === current) return undefined;
  }
}

async function isFile(file: string): Promise<boolean> {
  try {
    const stats = await stat(file);

    return stats.isFile();
  } catch (err) {
    if (isMissing(err)) return false;

    throw err;
  }
}

/**
 * Записывает конфиг проекта в его корень, создавая каталог маркера; первым полем идёт версия
 * формата файла.
 * @param {string} root Корень проекта.
 * @param {ProjectConfig} config Проверенный конфиг.
 * @returns {Promise<void>} Готово, когда файл записан.
 */
export async function writeProjectConfig(root: string, config: ProjectConfig): Promise<void> {
  await mkdir(path.join(root, MARKER_DIRECTORY), { recursive: true });
  const document = { schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION, ...config };

  await writeFile(path.join(root, PROJECT_CONFIG_FILE), `${JSON.stringify(document, null, 2)}\n`);
}
