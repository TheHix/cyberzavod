// Журнал проекта на диске: каталог, в котором каждая запись — файл
// `<коллекция>/<id>.json`. Один и тот же код хранит журнал и в репозитории проекта,
// и в каталоге рядом с ним: отличается только путь.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseRecord,
  type JournalRecord,
  type ProjectConfig,
  type RecordStore,
  type RecordType,
} from "@cyberzavod/core";
import { isNotFound } from "./project.ts";

/** Каталог записей каждого типа внутри журнала. */
export const RECORD_COLLECTIONS: Readonly<Record<RecordType, string>> = {
  session: "sessions",
  decision: "decisions",
  note: "notes",
};

/**
 * Рабочие файлы адаптеров внутри журнала: сырые журналы сессий и черновики. Это не записи,
 * в git они не идут.
 */
export const CAPTURE_DIRECTORY = "capture";

const RECORD_EXTENSION = ".json";

/** Ошибка журнала: файл записи не читается или не прошёл проверку. */
export class JournalError extends Error {}

/**
 * Каталог журнала проекта.
 * @param {string} root Корень проекта.
 * @param {ProjectConfig} config Конфиг проекта.
 * @returns {string} Абсолютный путь журнала: `journal` конфига от корня проекта.
 */
export function journalDirectory(root: string, config: ProjectConfig): string {
  return path.resolve(root, ...config.journal.split("/"));
}

// Каталога ещё нет — значит, и записей в нём нет; другие ошибки не глотаются.
async function recordFilesIn(directory: string): Promise<string[]> {
  try {
    const names = await readdir(directory);
    return names.filter((name) => name.endsWith(RECORD_EXTENSION)).sort();
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

async function readRecord(file: string): Promise<JournalRecord> {
  try {
    return parseRecord(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    throw new JournalError(`запись ${file} не прошла проверку: ${(err as Error).message}`, {
      cause: err,
    });
  }
}

/** Журнал в каталоге файловой системы. */
export class DirectoryRecordStore implements RecordStore {
  readonly #directory: string;

  /**
   * Открывает журнал в каталоге; каталог создаётся при первой записи.
   * @param {string} directory Абсолютный путь журнала.
   */
  constructor(directory: string) {
    this.#directory = directory;
  }

  /**
   * Перечисляет все записи журнала.
   * @returns {Promise<JournalRecord[]>} Записи по коллекциям, внутри коллекции — по имени файла.
   * @throws {JournalError} Если файл записи битый.
   */
  async list(): Promise<JournalRecord[]> {
    const records: JournalRecord[] = [];
    for (const collection of Object.values(RECORD_COLLECTIONS)) {
      const directory = path.join(this.#directory, collection);
      for (const name of await recordFilesIn(directory)) {
        records.push(await readRecord(path.join(directory, name)));
      }
    }
    return records;
  }

  /**
   * Сохраняет запись в файл `<коллекция>/<id>.json`.
   * @param {JournalRecord} record Проверенная запись.
   * @returns {Promise<void>} Готово, когда файл записан.
   */
  async write(record: JournalRecord): Promise<void> {
    const file = this.pathOf(record);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
  }

  /**
   * Где лежит или ляжет запись.
   * @param {JournalRecord} record Запись.
   * @returns {string} Абсолютный путь файла записи.
   */
  pathOf(record: JournalRecord): string {
    return path.join(this.#directory, RECORD_COLLECTIONS[record.type], `${record.id}.json`);
  }
}
