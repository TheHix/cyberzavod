// Каталоги записей сборок и поиск в них файлов — общее для точек входа.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseProjectConfig } from "../project.ts";

// Журналы внешнего проекта ложатся в клон завода (CYBERZAVOD_HOME), а не в сам проект:
// записи, черновики и публикация живут в одном месте. Пустая строка в переменной — не задано.
const factoryHome = process.env.CYBERZAVOD_HOME || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const recordingsDir = path.join(factoryHome, "recordings");
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** Путь конфига проекта от корня его репозитория: идентификатор проекта и версия завода. */
export const PROJECT_CONFIG_FILE = path.join(".cyberzavod", "project.json");

/** Конфиг проекта, в котором идёт сессия. */
export const PROJECT_CONFIG_PATH = path.join(projectDir, PROJECT_CONFIG_FILE);

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
 * Находит проект каталога: поднимается от него вверх до первого `.cyberzavod/project.json`.
 * Нет конфига на всём пути — каталог не принадлежит проекту завода, битый конфиг — предупреждение.
 * @param {string} directory Абсолютный путь каталога.
 * @returns {Promise<string | undefined>} `id` проекта или undefined, если проекта нет.
 */
export async function findProjectId(directory: string): Promise<string | undefined> {
  for (let current = directory; ; current = path.dirname(current)) {
    const configPath = path.join(current, PROJECT_CONFIG_FILE);
    try {
      return parseProjectConfig(JSON.parse(await readFile(configPath, "utf8"))).id;
    } catch (err) {
      if (!isNotFound(err)) {
        console.warn(`конфиг проекта ${configPath} не прочитан: ${String(err)}`);
        return undefined;
      }
    }
    if (path.dirname(current) === current) return undefined;
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
