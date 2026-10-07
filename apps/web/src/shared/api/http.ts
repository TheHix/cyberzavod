import { ApiRequestError, ApiResponseError } from "./errors.ts";

/** Запрос GET к API: в браузере — `fetch`, в тестах — подмена без сети. */
export type ApiRequest = (path: string) => Promise<Response>;

/** Код ошибки, когда тело ответа с ошибкой не JSON, например страница прокси. */
const UNKNOWN_ERROR_CODE = "unknown";

const browserRequest: ApiRequest = (path) => fetch(path);

function errorCodeOf(body: unknown): string {
  const code =
    typeof body === "object" && body !== null && "error" in body ? body.error : undefined;

  return typeof code === "string" ? code : UNKNOWN_ERROR_CODE;
}

async function requestErrorOf(response: Response, path: string): Promise<ApiRequestError> {
  // Ответ с ошибкой может прийти не от API, а от прокси перед ним — тогда тела JSON нет, и
  // остаётся только статус.
  const body: unknown = await response.json().catch(() => undefined);

  return new ApiRequestError(
    response.status,
    errorCodeOf(body),
    `API ответил ${response.status} на ${path}`,
  );
}

/**
 * Читает ответ API в JSON. Разбор ответа по контракту — дело того, кто запрашивает.
 * @param {string} path Путь от корня сайта: `/api/stats`.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<unknown>} Тело ответа.
 * @throws {ApiRequestError} Если API ответил ошибкой.
 * @throws {ApiResponseError} Если тело успешного ответа не JSON.
 */
export async function getJson(
  path: string,
  request: ApiRequest = browserRequest,
): Promise<unknown> {
  const response = await request(path);

  if (!response.ok) throw await requestErrorOf(response, path);

  try {
    return (await response.json()) as unknown;
  } catch (err) {
    throw new ApiResponseError(`ответ ${path} — не JSON`, { cause: err });
  }
}
