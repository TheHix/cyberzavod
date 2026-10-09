// `cyberzavod decision` and `cyberzavod note`: the human's decisions and notes in the project
// journal.

import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  parseRecord,
  RECORD_VERSION,
  type DecisionRecord,
  type JournalRecord,
  type NoteRecord,
  type RecordError,
  type RecordHeader,
} from "@cyberzavod/core";
import { DirectoryRecordStore } from "@cyberzavod/storage";
import type { CommandError } from "../errors.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { requireProjectAt } from "./project.ts";

const DATE_LENGTH = "2026-01-01".length;
const ID_SUFFIX_LENGTH = 8;

/**
 * Header of a human's record: an id from the date and a random tail, the current time.
 * @param {string} projectId Project of the record.
 * @param {Date} now Record time.
 * @returns {RecordHeader} Header of a manual record.
 */
export function manualHeader(projectId: string, now: Date): RecordHeader {
  const timestamp = now.toISOString();
  const suffix = randomUUID().slice(0, ID_SUFFIX_LENGTH);

  return {
    version: RECORD_VERSION,
    id: `${timestamp.slice(0, DATE_LENGTH)}-${suffix}`,
    timestamp,
    projectId,
    source: { type: "manual" },
  };
}

// The core validates the record before it reaches the disk: a one-line title, non-empty text.
async function writeRecord(
  directory: string,
  build: (projectId: string) => JournalRecord,
  messages: CliMessages,
): Promise<void> {
  const project = await requireProjectAt(directory);
  const store = new DirectoryRecordStore(project.journal);
  const record = parseRecord(build(project.config.projectId));

  await store.write(record);
  console.log(messages.journal.recorded(path.relative(project.root, store.pathOf(record))));
}

/** A decision to record: where to write, what was decided and the message language. */
export interface RecordDecisionOptions {
  /** Directory inside the project. */
  directory: string;
  /** What was decided, in one line. */
  title: string;
  /** Why, and what follows from it; may be empty. */
  description: string;
  /** Messages in the chosen language. */
  messages: CliMessages;
}

/**
 * Writes a decision to the project journal.
 * @param {RecordDecisionOptions} options Project directory, decision and messages.
 * @returns {Promise<void>} Done when the record is on disk.
 * @throws {CommandError} If the directory is not in a project.
 * @throws {RecordError} If the title is empty or spans several lines.
 */
export async function recordDecision(options: RecordDecisionOptions): Promise<void> {
  const { directory, title, description, messages } = options;
  const build = (projectId: string): DecisionRecord => ({
    ...manualHeader(projectId, new Date()),
    type: "decision",
    data: { title, description },
  });

  await writeRecord(directory, build, messages);
}

/**
 * Writes a note to the project journal.
 * @param {string} directory Directory inside the project.
 * @param {string} text Note text.
 * @param {CliMessages} messages Messages in the chosen language.
 * @returns {Promise<void>} Done when the record is on disk.
 * @throws {CommandError} If the directory is not in a project.
 * @throws {RecordError} If the text is empty.
 */
export async function recordNote(
  directory: string,
  text: string,
  messages: CliMessages,
): Promise<void> {
  const build = (projectId: string): NoteRecord => ({
    ...manualHeader(projectId, new Date()),
    type: "note",
    data: { text },
  });

  await writeRecord(directory, build, messages);
}
