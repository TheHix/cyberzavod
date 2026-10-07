import { getJson, type ApiRequest } from "@/shared/api/http.ts";
import type { Gallery, GalleryListing, SharedRecording } from "../model/gallery.ts";
import { parseGalleries, parseGallery, parseSharedRecording } from "../model/parse.ts";

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
