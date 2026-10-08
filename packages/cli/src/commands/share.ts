// `cyberzavod share` и `cyberzavod unshare`: отправка записи сессии в личную галерею и удаление.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRecordId, parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
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
import type { CliMessages } from "../messages/cli-messages.ts";
import { recordingLink } from "../sharing/links.ts";
import type { Sharing } from "../sharing/services.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

function requireRecordId(id: string): void {
  if (!isRecordId(id)) throw new CommandError((messages) => messages.errors.invalidRecordId(id));
}

async function readRecordText(project: ProjectAt, id: string): Promise<string> {
  const file = path.join(project.journal, RECORD_COLLECTIONS.session, `${id}.json`);

  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (!isNotFound(err)) throw err;

    const shown = path.relative(project.root, file);

    throw new CommandError((messages) => messages.errors.recordMissing({ id, file: shown }), {
      cause: err,
    });
  }
}

// Формат записи проверяет ядро: сервер смотрит только на конверт, второго описания формата нет.
function parseSession(text: string, id: string): SessionRecord {
  const record = parseKnownRecord(text, id);

  if (record.type !== "session") {
    throw new CommandError((messages) =>
      messages.errors.recordNotSession({ id, type: record.type }),
    );
  }

  return record;
}

function parseKnownRecord(text: string, id: string): JournalRecord {
  try {
    return parseRecord(JSON.parse(text));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    throw new CommandError((messages) => messages.errors.recordInvalid({ id, reason }), {
      cause: err,
    });
  }
}

function recordingLines(recordings: Me["recordings"]): string[] {
  return recordings.map((recording) => `  ${recording.id}  ${recording.title}`);
}

async function limitReachedError(sharing: Sharing, token: string): Promise<CommandError> {
  const me = await sharing.api.me(token);
  const { recordings, limit } = me;

  return new CommandError((messages) => {
    const lines = [
      messages.errors.limitReached,
      messages.share.galleryRecordings({ count: recordings.length, limit }),
      ...recordingLines(recordings),
      messages.share.freeUpSpace,
    ];

    return lines.join("\n");
  });
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

    throw await limitReachedError(sharing, token);
  }
}

/** Что отправить: проект, запись и язык сообщений. */
export interface ShareRecordingOptions {
  /** Каталог внутри проекта. */
  directory: string;
  /** Идентификатор записи сессии. */
  id: string;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/**
 * Отправляет запись сессии из журнала проекта в личную галерею автора.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {ShareRecordingOptions} options Каталог проекта, идентификатор записи и сообщения.
 * @returns {Promise<void>} Готово, когда запись отправлена и ссылка напечатана.
 * @throws {CommandError} Если id некорректен, записи нет или она не прошла проверку, нет входа
 *   или достигнут лимит записей.
 * @throws {ApiError} Если сервер отклонил запись.
 */
export async function shareRecording(
  sharing: Sharing,
  options: ShareRecordingOptions,
): Promise<void> {
  const { directory, id, messages } = options;

  requireRecordId(id);

  const project = await requireProjectAt(directory);
  const text = await readRecordText(project, id);
  const record = parseSession(text, id);

  const { uploaded, me } = await withToken(sharing, async (token) => ({
    uploaded: await upload(sharing, token, id, record),
    me: await sharing.api.me(token),
  }));
  const outcome = uploaded.isNew ? messages.share.sent(id) : messages.share.replaced(id);
  const link = recordingLink(sharing.siteUrl, uploaded.recording.slug);

  console.log(outcome);
  console.log(messages.share.link(link));

  if (!me.galleryPublic) {
    console.log(messages.share.galleryClosed);
    console.log(messages.share.openGalleryHint);
  }
}

/**
 * Удаляет запись из галереи автора.
 * @param {Sharing} sharing Зависимости команд публикации.
 * @param {string} id Идентификатор записи.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда сервер удалил запись.
 * @throws {CommandError} Если id некорректен или нет входа.
 * @throws {ApiError} Если такой записи в галерее нет.
 */
export async function unshareRecording(
  sharing: Sharing,
  id: string,
  messages: CliMessages,
): Promise<void> {
  requireRecordId(id);

  await withToken(sharing, (token) => sharing.api.deleteRecording(token, id));
  console.log(messages.share.removed(id));
}
