// Где адаптер держит свои файлы: сырые журналы сессий и черновики лежат в `capture/` журнала
// проекта. Каталог журнала задаёт конфиг проекта, поэтому журнал может лежать и в репозитории,
// и рядом с ним.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  CAPTURE_DIRECTORY,
  findProjectRoot,
  isNotFound,
  journalDirectory,
  ProjectFileError,
  readProjectConfig,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";

/** Каталоги адаптера в журнале проекта: сырые журналы сессий и черновики записей. */
export interface CaptureDirectories {
  raw: string;
  drafts: string;
}

/**
 * Каталоги адаптера в журнале проекта.
 * @param {string} journal Абсолютный путь журнала проекта.
 * @returns {CaptureDirectories} Каталоги сырых журналов и черновиков.
 */
export function captureDirectories(journal: string): CaptureDirectories {
  const capture = path.join(journal, CAPTURE_DIRECTORY, "claude");
  return { raw: path.join(capture, "raw"), drafts: path.join(capture, "drafts") };
}

/** Проект, найденный на диске: корень, конфиг и журнал. */
export interface LocatedProject {
  root: string;
  config: ProjectConfig;
  journal: string;
}

/**
 * Находит проект каталога и его журнал.
 * @param {string} directory Каталог внутри проекта.
 * @returns {Promise<LocatedProject | undefined>} Проект или undefined, если маркера нет.
 * @throws {ProjectFileError} Если конфиг проекта битый.
 */
export async function locateProject(directory: string): Promise<LocatedProject | undefined> {
  const root = await findProjectRoot(directory);
  if (root === undefined) return undefined;
  const config = await readProjectConfig(root);
  if (config === undefined) return undefined;
  return { root, config, journal: journalDirectory(root, config) };
}

/**
 * Находит проект каталога для команды, которой без проекта делать нечего.
 * @param {string} directory Каталог внутри проекта.
 * @returns {Promise<LocatedProject>} Проект.
 * @throws {Error} Если маркера нет на всём пути вверх или конфиг битый.
 */
export async function requireProject(directory: string): Promise<LocatedProject> {
  const project = await locateProject(directory);
  if (project === undefined) {
    throw new Error(`${directory} не в проекте Cyberzavod: сначала cyberzavod init`);
  }
  return project;
}

/**
 * Находит проект каталога: поднимается от него вверх до первого маркера. Нет маркера на всём
 * пути — каталог не принадлежит проекту, битый конфиг — предупреждение.
 * @param {string} directory Абсолютный путь каталога; может уже не существовать.
 * @returns {Promise<string | undefined>} `projectId` или undefined, если проекта нет.
 */
export async function findProjectId(directory: string): Promise<string | undefined> {
  try {
    return (await locateProject(directory))?.config.projectId;
  } catch (err) {
    if (!(err instanceof ProjectFileError)) throw err;
    console.warn(`конфиг проекта не прочитан: ${err.message}`);
    return undefined;
  }
}

// Каталога ещё нет — значит, и файлов в нём нет; другие ошибки не глотаются.
async function filesIn(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

/**
 * Находит в каталоге самый свежий по времени изменения файл с расширением.
 * @param {string} dir Каталог; если его нет, файлов в нём тоже нет.
 * @param {string} extension Расширение с точкой: `.jsonl`.
 * @returns {Promise<string | undefined>} Путь к файлу или undefined, если подходящих нет.
 */
export async function newestFile(dir: string, extension: string): Promise<string | undefined> {
  const names = (await filesIn(dir)).filter((name) => name.endsWith(extension));
  const withTimes = await Promise.all(
    names.map(async (name) => ({ name, mtime: (await stat(path.join(dir, name))).mtimeMs })),
  );
  const [newest] = withTimes.sort((a, b) => b.mtime - a.mtime);
  return newest === undefined ? undefined : path.join(dir, newest.name);
}
