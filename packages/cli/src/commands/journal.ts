// `cyberzavod decision` и `cyberzavod note`: решения и заметки человека в журнале проекта.

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
 * Шапка записи человека: идентификатор из даты и случайного хвоста, время сейчас.
 * @param {string} projectId Проект записи.
 * @param {Date} now Время записи.
 * @returns {RecordHeader} Шапка ручной записи.
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

// Запись проверяется ядром до того, как попасть на диск: заголовок в одну строку, непустой текст.
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

/** Решение для записи: где писать, что решили и язык сообщений. */
export interface RecordDecisionOptions {
  /** Каталог внутри проекта. */
  directory: string;
  /** Что решили, одной строкой. */
  title: string;
  /** Почему и что из этого следует; может быть пустым. */
  description: string;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/**
 * Записывает решение в журнал проекта.
 * @param {RecordDecisionOptions} options Каталог проекта, решение и сообщения.
 * @returns {Promise<void>} Готово, когда запись на диске.
 * @throws {CommandError} Если каталог не в проекте.
 * @throws {RecordError} Если заголовок пуст или в несколько строк.
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
 * Записывает заметку в журнал проекта.
 * @param {string} directory Каталог внутри проекта.
 * @param {string} text Текст заметки.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда запись на диске.
 * @throws {CommandError} Если каталог не в проекте.
 * @throws {RecordError} Если текст пуст.
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
