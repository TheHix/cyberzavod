// Файлы и каталоги проекта, которых может не быть.

import { readFile, rmdir } from "node:fs/promises";
import { isNotFound } from "@cyberzavod/storage";

/**
 * Читает текстовый файл, которого может не быть.
 * @param {string} file Абсолютный путь файла.
 * @returns {Promise<string | undefined>} Текст файла или undefined, если файла нет.
 * @throws {Error} Если файл не читается по другой причине, чем «нет файла».
 */
export async function readOptionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// `rmdir` отвечает по-разному на непустой каталог: ENOTEMPTY (Linux, macOS), EEXIST (часть ОС).
const DIRECTORY_NOT_EMPTY_CODES = new Set(["ENOTEMPTY", "EEXIST"]);

function isDirectoryNotEmpty(err: unknown): boolean {
  return err instanceof Error && "code" in err && DIRECTORY_NOT_EMPTY_CODES.has(String(err.code));
}

/**
 * Удаляет каталог, если он пуст; непустой или отсутствующий каталог остаётся как есть.
 * @param {string} directory Абсолютный путь каталога.
 * @returns {Promise<void>} Готово, когда каталог удалён или удалять нечего.
 * @throws {Error} Если удалить не получилось по другой причине.
 */
export async function removeDirectoryIfEmpty(directory: string): Promise<void> {
  try {
    await rmdir(directory);
  } catch (err) {
    if (isNotFound(err) || isDirectoryNotEmpty(err)) return;

    throw err;
  }
}
