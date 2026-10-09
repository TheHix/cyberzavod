// Storage boundary: the domain knows that records can be listed and saved, but not where
// they live: in the project repository, in a directory next to it, or somewhere else.

import type { JournalRecord } from "./record.ts";

/** Store of one project's journal records. */
export interface RecordStore {
  /**
   * Lists all journal records.
   * @returns {Promise<JournalRecord[]>} Validated records in the order the store chooses.
   */
  list(): Promise<JournalRecord[]>;
  /**
   * Saves a record; a record of the same type with the same `id` is replaced.
   * @param {JournalRecord} record The validated record.
   * @returns {Promise<void>} Resolves when the record is saved.
   */
  write(record: JournalRecord): Promise<void>;
}
