import { parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
import { ApiResponseError } from "@/shared/api/errors.ts";

// Only the core checks the recording format: the site has no second description of the format.
function checkedRecord(raw: unknown): JournalRecord {
  try {
    return parseRecord(raw);
  } catch (err) {
    throw new ApiResponseError("файл записи сайта не прошёл проверку", { cause: err });
  }
}

/**
 * Parses a full site recording file: the recording goes through the core's `parseRecord`, as at
 * site build time.
 * @param {unknown} raw Response body.
 * @returns {SessionRecord} The build session.
 * @throws {ApiResponseError} If the recording is broken or not a session.
 */
export function parseRecordingFile(raw: unknown): SessionRecord {
  const record = checkedRecord(raw);

  if (record.type !== "session") {
    throw new ApiResponseError(`файл записи сайта — ${record.type}, а не сессия`);
  }

  return record;
}
