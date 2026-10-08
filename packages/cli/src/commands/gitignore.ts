// Рабочие файлы адаптеров (сырые журналы сессий и черновики) несут исходные тексты промптов:
// в git проекта они не идут.

import { appendFile } from "node:fs/promises";
import path from "node:path";
import { CAPTURE_DIRECTORY } from "@cyberzavod/storage";
import { readOptionalText } from "../files.ts";

/** Файл git, куда `init` дописывает строку об игнорируемых рабочих файлах. */
export const GITIGNORE_FILE = ".gitignore";

/**
 * Строка `.gitignore` для рабочих файлов адаптеров, если журнал лежит в проекте.
 * @param {string} journal Каталог журнала от корня проекта через `/`.
 * @returns {string | undefined} Строка или undefined, если журнал вне проекта и игнорировать нечего.
 */
export function captureIgnoreEntry(journal: string): string | undefined {
  const relative = path.posix.normalize(journal);

  if (relative.startsWith("..") || path.isAbsolute(journal)) return undefined;

  return `/${relative}/${CAPTURE_DIRECTORY}/`;
}

/**
 * Дописывает строку в `.gitignore` проекта.
 * @param {string} root Корень проекта.
 * @param {string} entry Строка для `.gitignore`.
 * @returns {Promise<boolean>} true, если строка добавлена; false, если она там уже была.
 */
export async function appendIgnoreEntry(root: string, entry: string): Promise<boolean> {
  const file = path.join(root, GITIGNORE_FILE);
  const current = await readOptionalText(file);

  if (current?.split(/\r?\n/).includes(entry) === true) return false;

  const separator = current === undefined || current.endsWith("\n") ? "" : "\n";

  await appendFile(file, `${separator}${entry}\n`);

  return true;
}
