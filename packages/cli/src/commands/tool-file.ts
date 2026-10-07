// Собранный CLI в проекте: хуки агента запускают его, поэтому он лежит в проекте и идёт в git —
// хуки работают у всех, кто открыл проект, без сети и без установки Cyberzavod.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TOOL_FILE } from "@cyberzavod/storage";
import { readOptionalText } from "../files.ts";

function toolFilePath(root: string): string {
  return path.join(root, ...TOOL_FILE.split("/"));
}

// Перевод строк при выписке из git на Windows не делает файл устаревшим.
function sameText(left: string, right: string): boolean {
  return left.replace(/\r\n/g, "\n") === right.replace(/\r\n/g, "\n");
}

/**
 * Сравнивает собранный CLI в проекте с запущенным, ничего не записывая.
 * @param {string} root Корень проекта.
 * @param {string} tool Текст запущенного собранного CLI.
 * @returns {Promise<boolean>} true, если файла нет или он отличается.
 */
export async function isToolFileOutdated(root: string, tool: string): Promise<boolean> {
  const current = await readOptionalText(toolFilePath(root));

  return current === undefined || !sameText(current, tool);
}

/**
 * Обновляет собранный CLI в проекте, если он отличается от запущенного.
 * @param {string} root Корень проекта.
 * @param {string} tool Текст запущенного собранного CLI.
 * @returns {Promise<boolean>} true, если файл отличался и записан.
 */
export async function updateToolFile(root: string, tool: string): Promise<boolean> {
  if (!(await isToolFileOutdated(root, tool))) return false;

  const file = toolFilePath(root);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, tool);

  return true;
}
