import { parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
import { newestFirst } from "./order.ts";

// Записи читаются при сборке сайта: битая запись роняет сборку, а не страницу у зрителя.
// Ровно один уровень каталогов (`journal/<коллекция>/<id>.json`): рабочие файлы адаптеров
// лежат глубже, в `journal/capture/…`, и на сайт попадать не должны.
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

/** Опубликованные сессии сборок из журнала проекта, новые первыми. */
export const publishedRecordings: readonly SessionRecord[] = Object.entries(files)
  .map(parsePublished)
  .filter(isSession)
  .sort(newestFirst);
