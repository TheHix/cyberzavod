// Каталоги записей сборок и поиск в них файлов — общее для точек входа.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// Журналы внешнего проекта ложатся в клон завода (CYBERZAVOD_HOME), а не в сам проект:
// записи, черновики и публикация живут в одном месте. Пустая строка в переменной — не задано.
const factoryHome = process.env.CYBERZAVOD_HOME || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const recordingsDir = path.join(factoryHome, "recordings");
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** Конфиг проекта, в котором идёт сессия: идентификатор проекта и версия завода. */
export const PROJECT_CONFIG_PATH = path.join(projectDir, ".cyberzavod", "project.json");

/** Каталоги записей: сырые журналы и черновики вне git, опубликованные записи — в git. */
export const RECORDINGS_DIRS = {
  raw: path.join(recordingsDir, "raw"),
  drafts: path.join(recordingsDir, "drafts"),
  published: path.join(recordingsDir, "published"),
} as const;

/**
 * Отличает «файла нет» от остальных ошибок файловой системы.
 * @param {unknown} err Ошибка из node:fs.
 * @returns {boolean} true, если файла или каталога нет.
 */
export function isNotFound(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
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

/**
 * Путь для вывода в консоль: от корня записей.
 * @param {string} filePath Абсолютный путь.
 * @returns {string} Путь от корня записей.
 */
export function fromFactoryHome(filePath: string): string {
  return path.relative(factoryHome, filePath);
}
