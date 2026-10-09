import type { SessionRecord } from "@cyberzavod/core";
import { getJson, type ApiRequest } from "@/shared/api/http.ts";
import { parseRecordingFile } from "../model/parse.ts";
import { recordingFileUrl } from "../model/url.ts";

/**
 * Requests a full site recording from its file.
 * @param {string} id Recording id.
 * @param {ApiRequest} [request] Request; the browser `fetch` by default.
 * @returns {Promise<SessionRecord>} A recording that passed the core's check.
 * @throws {Error} `ApiRequestError` if the file is missing or the server responded with an error;
 *   `ApiResponseError` if the file is not JSON or the recording is broken or not a session.
 */
export async function fetchRecording(id: string, request?: ApiRequest): Promise<SessionRecord> {
  const body = await getJson(recordingFileUrl(id), request);

  return parseRecordingFile(body);
}
