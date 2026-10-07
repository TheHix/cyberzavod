// Чтение файлов проекта, которых может не быть.

import { readFile } from "node:fs/promises";
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
