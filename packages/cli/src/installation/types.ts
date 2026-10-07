// Что приносит с собой запущенная версия Cyberzavod.

import type { HarnessFiles } from "@cyberzavod/core";

/** Тексты установки в том виде, в каком их встраивает сборка. */
export interface Assets {
  harness: HarnessFiles;
  /** Шаблоны по имени файла. */
  templates: Readonly<Record<string, string>>;
  /** Текст собранного CLI; undefined — CLI запущен из исходников. */
  tool: string | undefined;
}
