// The project journal on disk: a directory where each record is a file
// `<collection>/<id>.json`. The same code keeps the journal both in the project repository
// and in a directory next to it: only the path differs.

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

/** Directory for records of each type inside the journal. */
export const RECORD_COLLECTIONS: Readonly<Record<RecordType, string>> = {
  session: "sessions",
  decision: "decisions",
  note: "notes",
};

/**
 * Adapters' working files inside the journal: raw session logs and drafts. These are not records
 * and do not go into git.
 */
export const CAPTURE_DIRECTORY = "capture";

const RECORD_EXTENSION = ".json";

/** Journal error: a record file cannot be read or failed validation. */
export class JournalError extends Error {}

/**
 * The project's journal directory.
 * @param {string} root Project root.
 * @param {ProjectConfig} config Project config.
 * @returns {string} Absolute journal path: the config's `journal` from the project root.
 */
export function journalDirectory(root: string, config: ProjectConfig): string {
  return path.resolve(root, ...config.journal.split("/"));
}

// No directory yet means no records in it either; other errors are not swallowed.
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
    const text = await readFile(file, "utf8");

    return parseRecord(JSON.parse(text));
  } catch (err) {
    throw new JournalError(`record ${file} failed validation: ${(err as Error).message}`, {
      cause: err,
    });
  }
}

/** Journal in a file system directory. */
export class DirectoryRecordStore implements RecordStore {
  readonly #directory: string;

  /**
   * Opens a journal in a directory; the directory is created on the first write.
   * @param {string} directory Absolute journal path.
   */
  constructor(directory: string) {
    this.#directory = directory;
  }

  /**
   * Lists all journal records.
   * @returns {Promise<JournalRecord[]>} Records by collection, within a collection by file name.
   * @throws {JournalError} If a record file is corrupt.
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
   * Saves a record to the file `<collection>/<id>.json`.
   * @param {JournalRecord} record The validated record.
   * @returns {Promise<void>} Resolves when the file is written.
   */
  async write(record: JournalRecord): Promise<void> {
    const file = this.pathOf(record);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
  }

  /**
   * Where the record lies or will lie.
   * @param {JournalRecord} record The record.
   * @returns {string} Absolute path of the record file.
   */
  pathOf(record: JournalRecord): string {
    return path.join(this.#directory, RECORD_COLLECTIONS[record.type], `${record.id}.json`);
  }
}
