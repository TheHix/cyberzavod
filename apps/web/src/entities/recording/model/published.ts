import { parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
import { newestFirst } from "./order.ts";

// Recordings are read at site build time: a broken recording fails the build, not a viewer's page.
// Exactly one directory level (`.cyberzavod/journal/<collection>/<id>.json`): adapter work files
// live deeper, in `capture/…`, and must not reach the site.
const files = import.meta.glob<unknown>("@journal/*/*.json", { eager: true, import: "default" });

function parsePublished([file, raw]: [string, unknown]): JournalRecord {
  try {
    return parseRecord(raw);
  } catch (err) {
    throw new Error(`запись журнала ${file} не прошла проверку`, { cause: err });
  }
}

function isSession(record: JournalRecord): record is SessionRecord {
  return record.type === "session";
}

/** Published build sessions from the project journal, newest first. */
export const publishedRecordings: readonly SessionRecord[] = Object.entries(files)
  .map(parsePublished)
  .filter(isSession)
  .sort(newestFirst);
