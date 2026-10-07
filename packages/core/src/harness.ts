// Harness — процесс разработки в текстах: принципы, этапы и ведущий. Здесь — модель этих текстов
// и их разбор; откуда взять тексты (каталог на диске или встроенные в сборку CLI), решают другие
// пакеты.

import { isLine } from "./guards.ts";
import { parseWorkflow, STAGES, type Stage, type Workflow } from "./stage.ts";

/** Что может делать роль этапа: только читать или ещё и менять файлы. */
export const STAGE_ACCESS = ["read", "write"] as const;

/** Доступ роли этапа к файлам проекта. */
export type StageAccess = (typeof STAGE_ACCESS)[number];

/** Роль этапа: агент, которому ведущий передаёт работу. */
export interface StageRole {
  /** Имя роли, например `analyst`; по нему адаптер называет файл агента. */
  name: string;
  access: StageAccess;
}

/** Описание этапа из `harness/stages/<этап>.md`. */
export interface StageGuide {
  stage: Stage;
  /** Название этапа для людей. */
  title: string;
  /** Одна строка о том, что делает этап. */
  description: string;
  /** Роль этапа; у этапа, который ведущий делает сам, её нет. */
  role?: StageRole;
  /** Текст этапа без шапки: инструкция роли или ведущему. */
  body: string;
}

/** Принцип из `harness/principles/`: имя файла без расширения и текст. */
export interface Principle {
  name: string;
  text: string;
}

/** Весь harness: принципы, этапы, процессы и правила ведущего. */
export interface Harness {
  principles: Principle[];
  stages: Record<Stage, StageGuide>;
  workflows: Workflow[];
  /** Как ведущий проводит задачу через этапы. */
  conductor: string;
}

/** Ошибка harness: файл этапа или процесса не прошёл проверку. */
export class HarnessError extends Error {}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FRONTMATTER_LINE = /^([a-z]+):\s*(.*)$/;

function frontmatterOf(text: string, stage: Stage): { fields: Map<string, string>; body: string } {
  const match = FRONTMATTER.exec(text);
  if (match === null) throw new HarnessError(`этап ${stage}: нет шапки между строками ---`);
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split("\n")) {
    const field = FRONTMATTER_LINE.exec(line);
    if (field === null) throw new HarnessError(`этап ${stage}: строка шапки «${line}» не поле`);
    fields.set(field[1] ?? "", (field[2] ?? "").trim());
  }
  return { fields, body: text.slice(match[0].length).trim() };
}

function isStageAccess(value: unknown): value is StageAccess {
  return (STAGE_ACCESS as readonly unknown[]).includes(value);
}

function roleOf(fields: ReadonlyMap<string, string>, stage: Stage): StageRole | undefined {
  const name = fields.get("role");
  if (name === undefined) return undefined;
  if (!/^[a-z][a-z-]*$/.test(name)) {
    throw new HarnessError(`этап ${stage}: role — строчные латинские буквы и «-»`);
  }
  const access = fields.get("access");
  if (!isStageAccess(access)) {
    throw new HarnessError(`этап ${stage}: access должен быть ${STAGE_ACCESS.join(" или ")}`);
  }
  return { name, access };
}

/**
 * Разбирает файл этапа: шапку `ключ: значение` между строками `---` и текст после неё.
 * @param {Stage} stage Этап, которому принадлежит файл.
 * @param {string} text Содержимое файла.
 * @returns {StageGuide} Описание этапа.
 * @throws {HarnessError} Если шапки нет, в ней нет названия или описания, или роль задана неверно.
 */
export function parseStageGuide(stage: Stage, text: string): StageGuide {
  const { fields, body } = frontmatterOf(text.replace(/\r\n/g, "\n"), stage);
  const title = fields.get("title");
  const description = fields.get("description");
  if (!isLine(title) || !isLine(description)) {
    throw new HarnessError(`этап ${stage}: в шапке нужны title и description`);
  }
  const role = roleOf(fields, stage);
  return role === undefined
    ? { stage, title, description, body }
    : { stage, title, description, role, body };
}

/**
 * Файлы harness: путь от корня harness через `/` → текст. Так harness одинаково приходит
 * из каталога на диске и из сборки CLI, где он встроен.
 */
export type HarnessFiles = Readonly<Record<string, string>>;

const MARKDOWN = ".md";
const JSON_EXTENSION = ".json";
const PRINCIPLES = "principles/";
const STAGES_DIRECTORY = "stages/";
const WORKFLOWS = "workflows/";
const CONDUCTOR = "conductor.md";

function requiredFile(files: HarnessFiles, name: string): string {
  const text = files[name];
  if (text === undefined) throw new HarnessError(`в harness нет файла ${name}`);
  return text;
}

// Файлы прямо в каталоге, без вложенных: порядок по имени, чтобы тексты не зависели от того,
// в каком порядке их отдал диск.
function filesIn(files: HarnessFiles, directory: string, extension: string): [string, string][] {
  return Object.entries(files)
    .filter(([name]) => name.startsWith(directory) && name.endsWith(extension))
    .map(([name, text]): [string, string] => [
      name.slice(directory.length, -extension.length),
      text,
    ])
    .filter(([name]) => !name.includes("/"))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

function workflowFrom(name: string, text: string): Workflow {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new HarnessError(`процесс ${name}: не JSON`, { cause: err });
  }
  const workflow = parseWorkflow(raw);
  if (workflow.name !== name) {
    throw new HarnessError(`процесс ${name}: name должен совпадать с именем файла`);
  }
  return workflow;
}

/**
 * Собирает harness из его файлов: принципы, этап на каждый из `STAGES`, процессы и правила ведущего.
 * @param {HarnessFiles} files Файлы harness.
 * @returns {Harness} Harness.
 * @throws {HarnessError} Если файла этапа или правил ведущего нет либо этап или процесс не прошёл
 *   проверку.
 */
export function parseHarness(files: HarnessFiles): Harness {
  const stages = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      parseStageGuide(stage, requiredFile(files, `${STAGES_DIRECTORY}${stage}${MARKDOWN}`)),
    ]),
  ) as Record<Stage, StageGuide>;
  return {
    principles: filesIn(files, PRINCIPLES, MARKDOWN).map(([name, text]) => ({
      name,
      text: text.trim(),
    })),
    stages,
    workflows: filesIn(files, WORKFLOWS, JSON_EXTENSION).map(([name, text]) =>
      workflowFrom(name, text),
    ),
    conductor: requiredFile(files, CONDUCTOR).trim(),
  };
}
