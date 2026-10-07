// Тексты установки, прочитанные из исходников: harness и шаблоны. Сборка CLI подменяет этот
// модуль встроенными текстами и собой самой (см. scripts/build.ts), поэтому собранному файлу
// не нужен ни репозиторий Cyberzavod, ни сеть.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readHarnessFiles } from "@cyberzavod/storage";
import type { Assets } from "./types.ts";

const REPOSITORY = path.resolve(import.meta.dirname, "../../../..");
const HARNESS_DIRECTORY = path.join(REPOSITORY, "harness");
const TEMPLATE_DIRECTORIES = [
  path.join(REPOSITORY, "packages/cli/templates"),
  path.join(REPOSITORY, "adapters/claude/templates"),
];

async function readTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};
  for (const directory of TEMPLATE_DIRECTORIES) {
    for (const name of await readdir(directory)) {
      templates[name] = await readFile(path.join(directory, name), "utf8");
    }
  }
  return templates;
}

/**
 * Читает тексты установки. Из исходников собранного CLI нет, поэтому `tool` пуст.
 * @returns {Promise<Assets>} Harness, шаблоны и собранный CLI.
 */
export async function readAssets(): Promise<Assets> {
  return {
    harness: await readHarnessFiles(HARNESS_DIRECTORY),
    templates: await readTemplates(),
    tool: undefined,
  };
}
