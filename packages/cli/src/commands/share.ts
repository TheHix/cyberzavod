// `cyberzavod share` и `cyberzavod unshare`: отправка записи сессии в личную галерею и удаление.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRecordId, parseRecord, RecordError, type SessionRecord } from "@cyberzavod/core";
import { isNotFound, RECORD_COLLECTIONS } from "@cyberzavod/storage";
import { CommandError } from "../errors.ts";
import {
  isApiError,
  LIMIT_REACHED_CODE,
  type ApiError,
  type Me,
  type UploadedRecording,
} from "../sharing/api.ts";
import { withToken } from "../sharing/authorization.ts";
import { recordingLink } from "../sharing/links.ts";
import type { Sharing } from "../sharing/services.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

function requireRecordId(id: string): void {
  if (!isRecordId(id)) {
    throw new CommandError(`${id} не похож на id записи: только буквы, цифры, «_» и «-»`);
  }
}

async function readRecordText(project: ProjectAt, id: string): Promise<string> {
  const file = path.join(project.journal, RECORD_COLLECTIONS.session, `${id}.json`);

  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (!isNotFound(err)) throw err;

    const shown = path.relative(project.root, file);

    throw new CommandError(`в журнале нет записи ${id}: файла ${shown} не существует`, {
      cause: err,
    });
  }
}

// Формат записи проверяет ядро: сервер смотрит только на конверт, второго описания формата нет.
function parseSession(text: string, id: string): SessionRecord {
  try {
    const record = parseRecord(JSON.parse(text));

    if (record.type !== "session") throw new RecordError(`тип ${record.type}, нужна сессия`);

    return record;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    throw new CommandError(`запись ${id} не прошла проверку: ${reason}`, { cause: err });
  }
}

function recordingLines(recordings: Me["recordings"]): string[] {
  return recordings.map((recording) => `  ${recording.id}  ${recording.title}`);
}

async function limitReachedError(
  sharing: Sharing,
  token: string,
  serverMessage: string,
): Promise<CommandError> {
  const me = await sharing.api.me(token);
  const lines = [
    serverMessage,
    `Записи в галерее (${me.recordings.length} из ${me.limit}):`,
    ...recordingLines(me.recordings),
    "Освободите место командой cyberzavod unshare <id>",
  ];

  return new CommandError(lines.join("\n"));
}

async function upload(
  sharing: Sharing,
  token: string,
  id: string,
  record: SessionRecord,
): Promise<UploadedRecording> {
  try {
    return await sharing.api.uploadRecording(token, id, record);
  } catch (err) {
    if (!isApiError(err, LIMIT_REACHED_CODE)) throw err;

    throw await limitReachedError(sharing, token, err.message);
  }
}

/**
 * Отправляет запись сессии из журнала проекта в личную галерею автора.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {string} directory Каталог внутри проекта.
 * @param {string} id Идентификатор записи сессии.
 * @returns {Promise<void>} Готово, когда запись отправлена и ссылка напечатана.
 * @throws {CommandError} Если id некорректен, записи нет или она не прошла проверку, нет входа
 *   или достигнут лимит записей.
 * @throws {ApiError} Если сервер отклонил запись.
 */
export async function shareRecording(
  sharing: Sharing,
  directory: string,
  id: string,
): Promise<void> {
  requireRecordId(id);

  const project = await requireProjectAt(directory);
  const text = await readRecordText(project, id);
  const record = parseSession(text, id);

  const { uploaded, me } = await withToken(sharing, async (token) => ({
    uploaded: await upload(sharing, token, id, record),
    me: await sharing.api.me(token),
  }));
  const verb = uploaded.isNew ? "отправлена" : "заменена";

  console.log(`запись ${id} ${verb}`);
  console.log(`ссылка: ${recordingLink(sharing.siteUrl, uploaded.recording.slug)}`);

  if (!me.galleryPublic) {
    console.log("галерея закрыта: запись видна только по этой ссылке");
    console.log("открыть галерею: cyberzavod gallery --public");
  }
}

/**
 * Удаляет запись из галереи автора.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {string} id Идентификатор записи.
 * @returns {Promise<void>} Готово, когда сервер удалил запись.
 * @throws {CommandError} Если id некорректен или нет входа.
 * @throws {ApiError} Если такой записи в галерее нет.
 */
export async function unshareRecording(sharing: Sharing, id: string): Promise<void> {
  requireRecordId(id);

  await withToken(sharing, (token) => sharing.api.deleteRecording(token, id));
  console.log(`запись ${id} удалена из галереи`);
}
