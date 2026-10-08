import type { SessionRecord } from "@cyberzavod/core";
import { getJson, type ApiRequest } from "@/shared/api/http.ts";
import { parseRecordingFile } from "../model/parse.ts";
import { recordingFileUrl } from "../model/url.ts";

/**
 * Запрашивает полную запись сайта из её файла.
 * @param {string} id id записи.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<SessionRecord>} Запись, прошедшая проверку ядра.
 * @throws {Error} `ApiRequestError`, если файла нет или сервер ответил ошибкой;
 *   `ApiResponseError`, если файл не JSON, запись битая или не сессия.
 */
export async function fetchRecording(id: string, request?: ApiRequest): Promise<SessionRecord> {
  const body = await getJson(recordingFileUrl(id), request);

  return parseRecordingFile(body);
}
