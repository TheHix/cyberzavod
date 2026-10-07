import { ApiRequestError } from "@/shared/api/errors.ts";
import { getJson, sendCommand, type ApiRequest } from "@/shared/api/http.ts";
import type { Gallery, GalleryListing, OwnGallery, SharedRecording } from "../model/gallery.ts";
import {
  parseGalleries,
  parseGallery,
  parseOwnGallery,
  parseSharedRecording,
} from "../model/parse.ts";

const UNAUTHORIZED_STATUS = 401;

function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === UNAUTHORIZED_STATUS;
}

/**
 * Запрашивает открытые галереи.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<readonly GalleryListing[]>} Галереи, свежие сверху.
 */
export async function fetchGalleries(request?: ApiRequest): Promise<readonly GalleryListing[]> {
  const body = await getJson("/api/galleries", request);

  return parseGalleries(body);
}

/**
 * Запрашивает открытую галерею автора.
 * @param {string} login Логин автора на GitHub.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<Gallery>} Галерея; закрытая и несуществующая — ошибка 404.
 */
export async function fetchGallery(login: string, request?: ApiRequest): Promise<Gallery> {
  const body = await getJson(`/api/galleries/${encodeURIComponent(login)}`, request);

  return parseGallery(body);
}

/**
 * Запрашивает запись по секретной ссылке.
 * @param {string} slug Секретная часть ссылки.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<SharedRecording>} Запись, прошедшая проверку ядра.
 */
export async function fetchSharedRecording(
  slug: string,
  request?: ApiRequest,
): Promise<SharedRecording> {
  const body = await getJson(`/api/recordings/${encodeURIComponent(slug)}`, request);

  return parseSharedRecording(body);
}

/**
 * Запрашивает свою галерею вошедшего автора: вход — по куке сайта.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<OwnGallery | undefined>} Галерея или `undefined`, если никто не вошёл (401).
 * @throws {ApiRequestError} Если API ответил другой ошибкой; ответ не того вида — `ApiResponseError`.
 */
export async function fetchOwnGallery(request?: ApiRequest): Promise<OwnGallery | undefined> {
  try {
    const body = await getJson("/api/me", request);

    return parseOwnGallery(body);
  } catch (err) {
    if (isUnauthorized(err)) return undefined;

    throw err;
  }
}

/**
 * Открывает или закрывает свою галерею.
 * @param {boolean} isPublic Открыть ли галерею.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<void>} Когда API принял изменение.
 */
export function setGalleryPublic(isPublic: boolean, request?: ApiRequest): Promise<void> {
  return sendCommand(
    { method: "PUT", path: "/api/me/gallery", body: { public: isPublic } },
    request,
  );
}

/**
 * Удаляет запись из своей галереи; ссылка на неё перестаёт работать.
 * @param {string} id id записи — имя файла в журнале автора.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<void>} Когда API удалил запись.
 */
export function deleteOwnRecording(id: string, request?: ApiRequest): Promise<void> {
  const path = `/api/me/recordings/${encodeURIComponent(id)}`;

  return sendCommand({ method: "DELETE", path }, request);
}
