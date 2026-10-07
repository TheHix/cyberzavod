// Этапы и процесс. Процесс (workflow) — порядок этапов, по которому идёт любая задача; что
// делает агент на этапе, описано в harness/stages/, а здесь — только словарь этапов и проверка
// описания процесса.

import { isLine, isObject } from "./guards.ts";

/**
 * Этапы процесса, которые знает завод, в порядке процесса по умолчанию: постановка, код, ревью,
 * проверки, фиксация. Новый этап — новая строка здесь, его станок в планах цеха и файл
 * `harness/stages/<этап>.md`.
 */
export const STAGES = ["planning", "implementation", "review", "verification", "record"] as const;

/** Этап процесса — одна из станций цеха. */
export type Stage = (typeof STAGES)[number];

/**
 * Проверяет, что значение — известный этап.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is Stage} true, если это один из `STAGES`.
 */
export function isStage(value: unknown): value is Stage {
  return (STAGES as readonly unknown[]).includes(value);
}

/** Процесс: имя и этапы по порядку. Описание лежит в `harness/workflows/<имя>.json`. */
export interface Workflow {
  name: string;
  stages: Stage[];
}

/** Ошибка описания процесса: оно пришло извне и не прошло проверку. */
export class WorkflowError extends Error {}

/**
 * Проверяет описание процесса, прочитанное из файла.
 * @param {unknown} raw Разобранный JSON процесса.
 * @returns {Workflow} Проверенный процесс; неизвестные поля отброшены.
 * @throws {WorkflowError} Если нет имени, этапов, этап неизвестен или повторяется.
 */
export function parseWorkflow(raw: unknown): Workflow {
  if (!isObject(raw)) throw new WorkflowError("процесс должен быть объектом");

  const { name, stages } = raw;

  if (!isLine(name)) throw new WorkflowError("name должно быть непустой строкой");
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new WorkflowError("stages должны быть непустым списком");
  }

  const unknownStage = stages.find((stage) => !isStage(stage));

  if (unknownStage !== undefined) {
    throw new WorkflowError(`неизвестный этап ${String(unknownStage)}`);
  }

  const hasDuplicates = new Set(stages).size !== stages.length;

  if (hasDuplicates) throw new WorkflowError("этапы повторяются");

  return { name, stages: stages as Stage[] };
}
