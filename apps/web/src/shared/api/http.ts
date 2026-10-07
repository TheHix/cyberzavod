import { ApiRequestError, ApiResponseError } from "./errors.ts";

/** Запрос к API: в браузере — `fetch`, в тестах — подмена без сети. */
export type ApiRequest = (path: string, init?: RequestInit) => Promise<Response>;

/** Запрос к API, который меняет данные: метод, путь и тело, если оно есть. */
export interface ApiCommand {
  readonly method: "PUT" | "POST" | "DELETE";
  /** Путь от корня сайта: `/api/me/gallery`. */
  readonly path: string;
  /** Тело запроса: уходит в JSON. */
  readonly body?: unknown;
}

/** Код ошибки, когда тело ответа с ошибкой не JSON, например страница прокси. */
const UNKNOWN_ERROR_CODE = "unknown";

// Кука входа уходит только на свой сайт: API и сайт — один адрес.
const browserRequest: ApiRequest = (path, init) =>
  fetch(path, { ...init, credentials: "same-origin" });

const JSON_HEADERS = { "Content-Type": "application/json" };

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

function requestInitOf(command: ApiCommand): RequestInit {
  if (command.body === undefined) return { method: command.method };

  return { method: command.method, headers: JSON_HEADERS, body: JSON.stringify(command.body) };
}

/**
 * Шлёт API запрос, который меняет данные. Ответ не читается: страница после изменения заново
 * спрашивает API, что получилось.
 * @param {ApiCommand} command Метод, путь и тело запроса.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<void>} Когда API ответил успехом.
 * @throws {ApiRequestError} Если API ответил ошибкой.
 */
export async function sendCommand(
  command: ApiCommand,
  request: ApiRequest = browserRequest,
): Promise<void> {
  const response = await request(command.path, requestInitOf(command));

  if (!response.ok) throw await requestErrorOf(response, command.path);
}
