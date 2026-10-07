// Установка Cyberzavod, из которой запущен CLI: harness и версия процесса.

import path from "node:path";

/** Версия harness, которую ставит в конфиг проекта этот CLI. */
export const HARNESS_VERSION = "0.3.0";

/** Каталог harness установки. */
export const HARNESS_DIRECTORY = path.resolve(import.meta.dirname, "../../../harness");

/** Каталог шаблонов CLI. */
export const TEMPLATES_DIRECTORY = path.resolve(import.meta.dirname, "../templates");
