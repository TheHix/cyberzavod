import { parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
import { ApiResponseError } from "@/shared/api/errors.ts";

// Формат записи проверяет только ядро: второго описания формата у сайта нет.
function checkedRecord(raw: unknown): JournalRecord {
  try {
    return parseRecord(raw);
  } catch (err) {
    throw new ApiResponseError("файл записи сайта не прошёл проверку", { cause: err });
  }
}

/**
 * Разбирает файл полной записи сайта: запись проходит `parseRecord` ядра, как при сборке сайта.
 * @param {unknown} raw Тело ответа.
 * @returns {SessionRecord} Сессия сборки.
 * @throws {ApiResponseError} Если запись битая или не сессия.
 */
export function parseRecordingFile(raw: unknown): SessionRecord {
  const record = checkedRecord(raw);

  if (record.type !== "session") {
    throw new ApiResponseError(`файл записи сайта — ${record.type}, а не сессия`);
  }

  return record;
}
