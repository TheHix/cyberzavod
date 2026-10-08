// Хуки в `.claude/settings.json` проекта: читает файл и сверяет с тем, что ставит адаптер.
// Ничего не пишет и не требует harness, поэтому годится для диагностики подключения.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { isNotFound } from "@cyberzavod/storage";
import { ClaudeError } from "../errors.ts";
import { GenerateError } from "./claude.ts";
import {
  inspectHooks,
  parseSettings,
  SETTINGS_FILE,
  SettingsError,
  type HooksInspection,
} from "./settings.ts";

/** Хуки прочитаны (`HooksInspection`) или `settings.json` разобрать нельзя (`unreadable`, `error`). */
export type HooksReading = HooksInspection | { kind: "unreadable"; error: ClaudeError };

async function readSettingsText(projectRoot: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(projectRoot, SETTINGS_FILE), "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// Диагностика `hooks` не того вида — текст формата, как и у `mergeSettings`; рамку даёт каталог.
function unparsedHooks(err: SettingsError): GenerateError {
  const reason = err.message;

  return new GenerateError(
    (messages) => messages.errors.settingsNotParsed({ file: SETTINGS_FILE, reason }),
    { cause: err },
  );
}

/**
 * Проверяет, стоят ли в `.claude/settings.json` проекта хуки адаптера нужной версии.
 * @param {string} projectRoot Корень проекта.
 * @param {string} version Версия Cyberzavod из конфига проекта.
 * @returns {Promise<HooksReading>} Состояние хуков; нет файла — `missing`; файл не JSON, не объект
 *   или с `hooks` не того вида — `unreadable` с ошибкой адаптера.
 * @throws {Error} Если файл не читается по другой причине, чем «нет файла».
 */
export async function inspectClaudeHooks(
  projectRoot: string,
  version: string,
): Promise<HooksReading> {
  const text = await readSettingsText(projectRoot);

  if (text === undefined) return { kind: "missing" };

  try {
    return inspectHooks(parseSettings(text, SETTINGS_FILE), version);
  } catch (err) {
    if (err instanceof ClaudeError) return { kind: "unreadable", error: err };

    if (err instanceof SettingsError) return { kind: "unreadable", error: unparsedHooks(err) };

    throw err;
  }
}
