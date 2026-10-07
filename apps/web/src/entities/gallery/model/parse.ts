import { parseRecord, type JournalRecord, type SessionRecord } from "@cyberzavod/core";
import { ApiResponseError } from "@/shared/api/errors.ts";
import { arrayAt, booleanAt, countAt, objectAt, stringAt } from "@/shared/api/fields.ts";
import type { Gallery, GalleryListing, RecordingSummary, SharedRecording } from "./gallery.ts";

function summaryOf(raw: unknown): RecordingSummary {
  const place = "запись галереи";
  const summary = objectAt(raw, place);

  return {
    id: stringAt(summary, "id", place),
    slug: stringAt(summary, "slug", place),
    projectId: stringAt(summary, "projectId", place),
    title: stringAt(summary, "title", place),
    language: stringAt(summary, "language", place),
    startedAt: stringAt(summary, "startedAt", place),
    uploadedAt: stringAt(summary, "uploadedAt", place),
  };
}

function listingOf(raw: unknown): GalleryListing {
  const place = "галерея в списке";
  const listing = objectAt(raw, place);

  return {
    login: stringAt(listing, "login", place),
    recordingCount: countAt(listing, "recordingCount", place),
    updatedAt: stringAt(listing, "updatedAt", place),
  };
}

// Формат записи проверяет только ядро: второго описания формата у сайта нет.
function checkedRecord(raw: unknown): JournalRecord {
  try {
    return parseRecord(raw);
  } catch (err) {
    throw new ApiResponseError("запись из галереи не прошла проверку", { cause: err });
  }
}

function sessionOf(raw: unknown): SessionRecord {
  const record = checkedRecord(raw);

  if (record.type !== "session") {
    throw new ApiResponseError(`запись из галереи — ${record.type}, а не сессия`);
  }

  return record;
}

/**
 * Разбирает ответ `GET /api/galleries`.
 * @param {unknown} raw Тело ответа.
 * @returns {readonly GalleryListing[]} Открытые галереи в порядке API — свежие сверху.
 * @throws {ApiResponseError} Если ответ не того вида.
 */
export function parseGalleries(raw: unknown): readonly GalleryListing[] {
  const place = "ответ /api/galleries";
  const response = objectAt(raw, place);

  return arrayAt(response, "galleries", place).map(listingOf);
}

/**
 * Разбирает ответ `GET /api/galleries/{login}`.
 * @param {unknown} raw Тело ответа.
 * @returns {Gallery} Галерея автора с записями в порядке API — свежие сверху.
 * @throws {ApiResponseError} Если ответ не того вида.
 */
export function parseGallery(raw: unknown): Gallery {
  const place = "ответ /api/galleries/{login}";
  const gallery = objectAt(raw, place);

  return {
    login: stringAt(gallery, "login", place),
    recordings: arrayAt(gallery, "recordings", place).map(summaryOf),
  };
}

/**
 * Разбирает ответ `GET /api/recordings/{slug}`: запись проходит `parseRecord` ядра, как
 * записи из журнала при сборке сайта.
 * @param {unknown} raw Тело ответа.
 * @returns {SharedRecording} Сессия, её автор и открыта ли его галерея.
 * @throws {ApiResponseError} Если ответ не того вида или запись не сессия либо битая.
 */
export function parseSharedRecording(raw: unknown): SharedRecording {
  const place = "ответ /api/recordings/{slug}";
  const response = objectAt(raw, place);

  return {
    owner: stringAt(response, "owner", place),
    galleryPublic: booleanAt(response, "galleryPublic", place),
    record: sessionOf(response["record"]),
  };
}
