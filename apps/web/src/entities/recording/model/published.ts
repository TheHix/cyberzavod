import { parseRecording, type Recording } from "@cyberzavod/core";
import { newestFirst } from "./order.ts";

// Записи читаются при сборке сайта: битая запись роняет сборку, а не страницу у зрителя.
const files = import.meta.glob<unknown>("@recordings/*.json", { eager: true, import: "default" });

function parsePublished([file, raw]: [string, unknown]): Recording {
  try {
    return parseRecording(raw);
  } catch (err) {
    throw new Error(`опубликованная запись ${file} не прошла проверку`, { cause: err });
  }
}

/** Опубликованные записи сборок, новые первыми. */
export const publishedRecordings: readonly Recording[] = Object.entries(files)
  .map(parsePublished)
  .sort(newestFirst);
