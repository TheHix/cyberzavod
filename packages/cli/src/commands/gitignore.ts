// Рабочие файлы адаптеров (сырые журналы сессий и черновики) несут исходные тексты промптов:
// в git проекта они не идут.

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { CAPTURE_DIRECTORY, isNotFound } from "@cyberzavod/storage";

const GITIGNORE = ".gitignore";

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

/**
 * Дописывает в `.gitignore` проекта рабочие файлы адаптеров, если журнал лежит в проекте.
 * @param {string} root Корень проекта.
 * @param {string} journal Каталог журнала от корня проекта через `/`.
 * @returns {Promise<string | undefined>} Добавленная строка или undefined, если добавлять нечего.
 */
export async function ignoreCapture(root: string, journal: string): Promise<string | undefined> {
  const relative = path.posix.normalize(journal);
  if (relative.startsWith("..") || path.isAbsolute(journal)) return undefined;
  const entry = `/${relative}/${CAPTURE_DIRECTORY}/`;
  const file = path.join(root, GITIGNORE);
  const current = await readOptional(file);
  if (current?.split(/\r?\n/).includes(entry) === true) return undefined;
  const separator = current === undefined || current.endsWith("\n") ? "" : "\n";
  await appendFile(file, `${separator}${entry}\n`);
  return entry;
}
