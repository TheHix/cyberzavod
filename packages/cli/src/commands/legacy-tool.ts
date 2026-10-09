// Собранный CLI прежних версий: до 0.8.0 `init` и `sync` клали его в проект, а хуки запускали
// оттуда. Теперь хуки идут через npx, и `sync` убирает этот файл.

import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { isNotFound, LEGACY_TOOL_FILE } from "@cyberzavod/storage";
import { removeDirectoryIfEmpty } from "../files.ts";

function legacyToolPath(root: string): string {
  return path.join(root, ...LEGACY_TOOL_FILE.split("/"));
}

/**
 * Проверяет, лежит ли в проекте собранный CLI прежних версий.
 * @param {string} root Корень проекта.
 * @returns {Promise<boolean>} true, если файл на месте.
 * @throws {Error} Если файл не прочитать по другой причине, чем «нет файла».
 */
export async function hasLegacyTool(root: string): Promise<boolean> {
  try {
    await stat(legacyToolPath(root));

    return true;
  } catch (err) {
    if (isNotFound(err)) return false;

    throw err;
  }
}

/**
 * Удаляет собранный CLI прежних версий и каталог `bin`, если в нём больше ничего нет.
 * @param {string} root Корень проекта.
 * @returns {Promise<void>} Готово, когда файл удалён.
 * @throws {Error} Если удалить не получилось по другой причине, чем «нет файла» или «каталог не пуст».
 */
export async function removeLegacyTool(root: string): Promise<void> {
  const file = legacyToolPath(root);

  await rm(file, { force: true });
  await removeDirectoryIfEmpty(path.dirname(file));
}
