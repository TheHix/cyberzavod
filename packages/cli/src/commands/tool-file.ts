// Собранный CLI в проекте: хуки агента запускают его, поэтому он лежит в проекте и идёт в git —
// хуки работают у всех, кто открыл проект, без сети и без установки Cyberzavod.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNotFound, TOOL_FILE } from "@cyberzavod/storage";

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

// Перевод строк при выписке из git на Windows не делает файл устаревшим.
function sameText(left: string, right: string): boolean {
  return left.replace(/\r\n/g, "\n") === right.replace(/\r\n/g, "\n");
}

/**
 * Сравнивает собранный CLI в проекте с запущенным и, если не только проверка, обновляет его.
 * @param {string} root Корень проекта.
 * @param {string} tool Текст запущенного собранного CLI.
 * @param {boolean} check Только сравнить, ничего не записывая.
 * @returns {Promise<boolean>} true, если файл отличался (и, кроме проверки, записан).
 */
export async function syncToolFile(root: string, tool: string, check: boolean): Promise<boolean> {
  const file = path.join(root, ...TOOL_FILE.split("/"));
  const current = await readOptional(file);
  if (current !== undefined && sameText(current, tool)) return false;
  if (check) return true;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, tool);
  return true;
}
