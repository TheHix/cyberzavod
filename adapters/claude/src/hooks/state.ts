// Состояние хуков между вызовами — файлы во временном каталоге, по файлу на сессию и вид:
// отпечаток кода в начале хода, счётчик отказов хука остановки, вывод проверок и отметка
// «позвал человека».

import { unlink } from "node:fs/promises";
import path from "node:path";
import { isNotFound } from "@cyberzavod/storage";
import type { ClaudeMessages } from "../messages/claude-messages.ts";

/** Вид состояния хука. */
export type HookStateName = "turn-start" | "stop-blocks" | "checks-output" | "human-call";

const STATE_PREFIX = "cyberzavod";
const UNSAFE_SESSION_CHARACTERS = /[^A-Za-z0-9_-]/g;
const UNKNOWN_SESSION = "unknown";

/**
 * Путь файла состояния хука. Идентификатор сессии чистится: он уходит в имя файла.
 * @param {string} tmpDir Каталог временных файлов.
 * @param {string} sessionId Идентификатор сессии из полезной нагрузки хука.
 * @param {HookStateName} name Вид состояния.
 * @returns {string} Путь файла.
 */
export function hookStatePath(tmpDir: string, sessionId: string, name: HookStateName): string {
  const safeSession = sessionId.replace(UNSAFE_SESSION_CHARACTERS, "") || UNKNOWN_SESSION;

  return path.join(tmpDir, `${STATE_PREFIX}-${name}-${safeSession}`);
}

/**
 * Забирает отметку «хук остановки сдался и позвал человека»: удаляет её файл. Удалось — отметка
 * была, и промпт после неё — вызов хуком остановки. Нет файла — отметки не было. Другая ошибка
 * не роняет хук записи, а становится предупреждением: промпт пишется как обычный.
 * @param {string} sessionId Идентификатор сессии из полезной нагрузки хука.
 * @param {string} tmpDir Каталог временных файлов.
 * @param {ClaudeMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<boolean>} true, если отметка была и удалена.
 */
export async function claimHumanCallMarker(
  sessionId: string,
  tmpDir: string,
  messages: ClaudeMessages,
): Promise<boolean> {
  const markerPath = hookStatePath(tmpDir, sessionId, "human-call");

  try {
    await unlink(markerPath);

    return true;
  } catch (err) {
    if (!isNotFound(err)) {
      console.warn(messages.record.markerNotClaimed({ file: markerPath, reason: String(err) }));
    }

    return false;
  }
}
