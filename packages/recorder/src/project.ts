// Конфиг проекта: `.cyberzavod/project.json` в репозитории, где идёт сборка. Из него в сборку
// попадают идентификатор проекта и версия завода.

import { isFactoryVersion, isRecordingId } from "@cyberzavod/core";

/** Что сборка узнаёт о проекте из его конфига. */
export interface ProjectConfig {
  /** Идентификатор проекта: буквы, цифры, «_» и «-». */
  id: string;
  /** Версия завода одной строкой. */
  factory: string;
}

/** Ошибка конфига проекта: файл не объект или в нём нет `id` либо `factory` нужного вида. */
export class ProjectConfigError extends Error {}

/**
 * Проверяет конфиг проекта, прочитанный из файла. Неизвестные поля допустимы — их добавят
 * следующие задачи, — но дальше идут только `id` и `factory`. Поле `checks` читают хуки
 * остановки (`.claude/hooks/lib.sh`), рекордеру оно не нужно, поэтому схема `checks` здесь
 * не проверяется.
 * @param {unknown} raw Разобранный JSON конфига.
 * @returns {ProjectConfig} Проверенный конфиг.
 * @throws {ProjectConfigError} Если конфиг не объект или `id` либо `factory` некорректны.
 */
export function parseProjectConfig(raw: unknown): ProjectConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new ProjectConfigError("конфиг проекта должен быть объектом");
  }
  const { id, factory } = raw as Record<string, unknown>;
  if (!isRecordingId(id)) {
    throw new ProjectConfigError("id должен состоять из букв, цифр, «_» и «-»");
  }
  if (!isFactoryVersion(factory)) {
    throw new ProjectConfigError("factory должна быть непустой строкой без переводов строки");
  }
  return { id, factory };
}
