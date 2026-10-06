// Каталоги записей сборок и поиск в них файлов — общее для точек входа.

import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { parseProjectConfig } from "../project.ts";

// Журналы внешнего проекта ложатся в клон завода (CYBERZAVOD_HOME), а не в сам проект:
// записи, черновики и публикация живут в одном месте. Пустая строка в переменной — не задано.
const factoryHome = process.env.CYBERZAVOD_HOME || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const recordingsDir = path.join(factoryHome, "recordings");
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const DEFAULT_TMP_DIR = "/tmp";

/** Каталог временных файлов хуков: `TMPDIR`, а если он не задан, `/tmp` — как у `state_file`. */
export const TMP_DIR = process.env.TMPDIR || DEFAULT_TMP_DIR;

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

const FILE_NOT_FOUND = "ENOENT";
const NOT_A_DIRECTORY = "ENOTDIR";

/**
 * Отличает «файла нет» от остальных ошибок файловой системы.
 * @param {unknown} err Ошибка из node:fs.
 * @returns {boolean} true, если файла или каталога нет.
 */
export function isNotFound(err: unknown): boolean {
  return hasErrorCode(err, FILE_NOT_FOUND);
}

function hasErrorCode(err: unknown, code: string): boolean {
  return err instanceof Error && "code" in err && err.code === code;
}

// Для конфига «нет» и тогда, когда на пути лежит файл вместо каталога: путь из команды может
// вести сквозь файл (ENOTDIR), и проект ищется выше.
function isConfigMissing(err: unknown): boolean {
  return isNotFound(err) || hasErrorCode(err, NOT_A_DIRECTORY);
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

// Имя отметки хука остановки совпадает с `state_file … human-call` из .claude/hooks/lib.sh:
// session_id чистится так же, как там, и пустой остаётся `unknown`.
const HUMAN_CALL_MARKER_PREFIX = "factory-human-call";
const UNSAFE_SESSION_CHARACTERS = /[^A-Za-z0-9_-]/g;
const UNKNOWN_SESSION = "unknown";

/**
 * Путь отметки «хук остановки сдался и позвал человека»: её оставляет stop-gate.sh, а хук записи
 * забирает на следующем промпте человека.
 * @param {string} sessionId Идентификатор сессии из полезной нагрузки хука.
 * @param {string} tmpDir Каталог временных файлов: `TMPDIR` или `/tmp`.
 * @returns {string} Путь файла отметки, как его называет `state_file` хуков.
 */
export function humanCallMarkerPath(sessionId: string, tmpDir: string): string {
  const safeSession = sessionId.replace(UNSAFE_SESSION_CHARACTERS, "") || UNKNOWN_SESSION;
  return path.join(tmpDir, `${HUMAN_CALL_MARKER_PREFIX}-${safeSession}`);
}

/**
 * Забирает отметку вызова человека: удаляет её файл. Удалось — отметка была, и промпт после
 * неё — вызов хуком остановки. Нет файла — отметки не было. Другая ошибка не роняет хук записи,
 * а становится предупреждением: промпт пишется как обычный.
 * @param {string} sessionId Идентификатор сессии из полезной нагрузки хука.
 * @param {string} tmpDir Каталог временных файлов: `TMPDIR` или `/tmp`.
 * @returns {Promise<boolean>} true, если отметка была и удалена.
 */
export async function claimHumanCallMarker(sessionId: string, tmpDir: string): Promise<boolean> {
  const markerPath = humanCallMarkerPath(sessionId, tmpDir);
  try {
    await unlink(markerPath);
    return true;
  } catch (err) {
    if (!isNotFound(err)) console.warn(`отметка ${markerPath} не забрана: ${String(err)}`);
    return false;
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
      if (!isConfigMissing(err)) {
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
