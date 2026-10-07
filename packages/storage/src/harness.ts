// Harness на диске: `principles/*.md`, `stages/<этап>.md`, `workflows/*.json` и `conductor.md`.
// Разбор текстов — в ядре, здесь — где они лежат и как их прочитать.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  HarnessError,
  parseStageGuide,
  parseWorkflow,
  STAGES,
  type Harness,
  type Principle,
  type Stage,
  type StageGuide,
  type Workflow,
} from "@cyberzavod/core";

const MARKDOWN = ".md";
const JSON_EXTENSION = ".json";

async function namesIn(directory: string, extension: string): Promise<string[]> {
  const names = await readdir(directory);
  return names.filter((name) => name.endsWith(extension)).sort();
}

async function readPrinciples(directory: string): Promise<Principle[]> {
  const names = await namesIn(directory, MARKDOWN);
  return Promise.all(
    names.map(async (name) => ({
      name: path.basename(name, MARKDOWN),
      text: (await readFile(path.join(directory, name), "utf8")).trim(),
    })),
  );
}

async function readStages(directory: string): Promise<Record<Stage, StageGuide>> {
  const guides = await Promise.all(
    STAGES.map(async (stage) => {
      const text = await readFile(path.join(directory, `${stage}${MARKDOWN}`), "utf8");
      return [stage, parseStageGuide(stage, text)] as const;
    }),
  );
  return Object.fromEntries(guides) as Record<Stage, StageGuide>;
}

async function readWorkflow(file: string): Promise<Workflow> {
  const workflow = parseWorkflow(JSON.parse(await readFile(file, "utf8")));
  const expected = path.basename(file, JSON_EXTENSION);
  if (workflow.name !== expected) {
    throw new HarnessError(`процесс ${file}: name должен совпадать с именем файла ${expected}`);
  }
  return workflow;
}

async function readWorkflows(directory: string): Promise<Workflow[]> {
  const names = await namesIn(directory, JSON_EXTENSION);
  return Promise.all(names.map((name) => readWorkflow(path.join(directory, name))));
}

/**
 * Читает harness из каталога.
 * @param {string} directory Каталог harness.
 * @returns {Promise<Harness>} Принципы по имени файла, все этапы, процессы и правила ведущего.
 * @throws {HarnessError} Если файл этапа или процесса не прошёл проверку.
 */
export async function loadHarness(directory: string): Promise<Harness> {
  return {
    principles: await readPrinciples(path.join(directory, "principles")),
    stages: await readStages(path.join(directory, "stages")),
    workflows: await readWorkflows(path.join(directory, "workflows")),
    conductor: (await readFile(path.join(directory, "conductor.md"), "utf8")).trim(),
  };
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
