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
): Promise<void> {
  const project = await requireProjectAt(directory);
  const store = new DirectoryRecordStore(project.journal);
  const record = parseRecord(build(project.config.projectId));
  await store.write(record);
  console.log(`записано: ${path.relative(project.root, store.pathOf(record))}`);
}

/**
 * Записывает решение в журнал проекта.
 * @param {string} directory Каталог внутри проекта.
 * @param {string} title Что решили, одной строкой.
 * @param {string} description Почему и что из этого следует; может быть пустым.
 * @returns {Promise<void>} Готово, когда запись на диске.
 * @throws {CommandError} Если каталог не в проекте.
 * @throws {RecordError} Если заголовок пуст или в несколько строк.
 */
export async function recordDecision(
  directory: string,
  title: string,
  description: string,
): Promise<void> {
  await writeRecord(directory, (projectId): DecisionRecord => ({
    ...manualHeader(projectId, new Date()),
    type: "decision",
    data: { title, description },
  }));
}

/**
 * Записывает заметку в журнал проекта.
 * @param {string} directory Каталог внутри проекта.
 * @param {string} text Текст заметки.
 * @returns {Promise<void>} Готово, когда запись на диске.
 * @throws {CommandError} Если каталог не в проекте.
 * @throws {RecordError} Если текст пуст.
 */
export async function recordNote(directory: string, text: string): Promise<void> {
  await writeRecord(directory, (projectId): NoteRecord => ({
    ...manualHeader(projectId, new Date()),
    type: "note",
    data: { text },
  }));
}
