// Harness на диске: каталог с `principles/*.md`, `stages/<этап>.md`, `workflows/*.json` и
// `conductor.md`. Здесь — только чтение файлов; разбор текстов — в ядре.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  HarnessError,
  parseHarness,
  type Harness,
  type HarnessFiles,
  type Workflow,
} from "@cyberzavod/core";

/**
 * Читает все файлы каталога harness: путь от каталога через `/` → текст.
 * @param {string} directory Каталог harness.
 * @returns {Promise<HarnessFiles>} Файлы harness.
 */
export async function readHarnessFiles(directory: string): Promise<HarnessFiles> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files: Record<string, string> = {};

  const fileEntries = entries.filter((candidate) => candidate.isFile());

  for (const entry of fileEntries) {
    const file = path.join(entry.parentPath, entry.name);
    const name = path.relative(directory, file).split(path.sep).join("/");

    files[name] = await readFile(file, "utf8");
  }

  return files;
}

/**
 * Читает harness из каталога.
 * @param {string} directory Каталог harness.
 * @returns {Promise<Harness>} Принципы по имени файла, все этапы, процессы и правила ведущего.
 * @throws {HarnessError} Если файл этапа или процесса не прошёл проверку.
 */
export async function loadHarness(directory: string): Promise<Harness> {
  const files = await readHarnessFiles(directory);

  return parseHarness(files);
}

/**
 * Находит процесс по имени.
 * @param {Harness} harness Harness.
 * @param {string} name Имя процесса из конфига проекта.
 * @returns {Workflow} Процесс.
 * @throws {HarnessError} Если такого процесса нет.
 */
export function workflowOf(harness: Harness, name: string): Workflow {
  const workflow = harness.workflows.find((candidate) => candidate.name === name);

  if (workflow === undefined) {
    const known = harness.workflows.map((candidate) => candidate.name).join(", ");

    throw new HarnessError(`процесса ${name} нет в harness; есть: ${known}`);
  }

  return workflow;
}
