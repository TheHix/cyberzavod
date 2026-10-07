// Сервер Cyberzavod: интерфейс, которым пользуются команды, и его реализация поверх HTTP.
// Формат ответов — контракт API; всё, что пришло по сети, проверяется до того, как его получат команды.

import { isObject, readJsonBody, sendRequest, type FetchFunction } from "./http.ts";

/** Краткие сведения о записи автора на сервере. */
export interface RecordingSummary {
  id: string;
  slug: string;
  projectId: string;
  title: string;
  language: string;
  startedAt: string;
  uploadedAt: string;
}

/** Автор, его галерея и записи. */
export interface Me {
  login: string;
  galleryPublic: boolean;
  limit: number;
  recordings: RecordingSummary[];
}

/** Итог отправки записи. */
export interface UploadedRecording {
  recording: RecordingSummary;
  /** Запись появилась впервые, а не заменила прежнюю. */
  isNew: boolean;
}

/** Ошибка сервера: код и текст из его ответа. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  /**
   * Ошибка, о которой сообщил сервер.
   * @param {string} message Текст ошибки по-русски из ответа сервера.
   * @param {string} code Код ошибки из ответа сервера, например `limit_reached`.
   * @param {number} status HTTP-статус ответа.
   */
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Код ошибки сервера, когда он не принял токен. */
export const UNAUTHORIZED_CODE = "unauthorized";

/** Код ошибки сервера, когда у автора уже максимум записей. */
export const LIMIT_REACHED_CODE = "limit_reached";

const INVALID_RESPONSE_CODE = "invalid_response";
const HTTP_ERROR_CODE = "http_error";
const NEW_RECORDING_STATUS = 201;

/** Что команды берут у сервера; запросы автора несут токен GitHub. */
export interface CyberzavodApi {
  /** Идентификатор приложения GitHub, через которое идёт вход. */
  githubClientId(): Promise<string>;
  me(token: string): Promise<Me>;
  uploadRecording(token: string, id: string, record: unknown): Promise<UploadedRecording>;
  deleteRecording(token: string, id: string): Promise<void>;
  setGalleryPublic(token: string, isPublic: boolean): Promise<void>;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function invalidResponse(what: string, status: number): ApiError {
  return new ApiError(`сервер вернул неожиданный ответ: ${what}`, INVALID_RESPONSE_CODE, status);
}

function parseSummary(raw: unknown, status: number): RecordingSummary {
  if (!isObject(raw)) throw invalidResponse("запись не объект", status);

  const { id, slug, projectId, title, language, startedAt, uploadedAt } = raw;

  if (
    !isString(id) ||
    !isString(slug) ||
    !isString(projectId) ||
    !isString(title) ||
    !isString(language) ||
    !isString(startedAt) ||
    !isString(uploadedAt)
  ) {
    throw invalidResponse("в записи не хватает полей", status);
  }

  return { id, slug, projectId, title, language, startedAt, uploadedAt };
}

function parseMe(raw: unknown, status: number): Me {
  if (!isObject(raw)) throw invalidResponse("автор не объект", status);

  const { login, galleryPublic, limit, recordings } = raw;

  if (
    !isString(login) ||
    typeof galleryPublic !== "boolean" ||
    typeof limit !== "number" ||
    !Array.isArray(recordings)
  ) {
    throw invalidResponse("у автора не хватает полей", status);
  }

  const summaries = recordings.map((summary: unknown) => parseSummary(summary, status));

  return { login, galleryPublic, limit, recordings: summaries };
}

function errorOf(body: unknown, status: number): ApiError {
  if (isObject(body) && isString(body.error) && isString(body.message)) {
    return new ApiError(body.message, body.error, status);
  }

  return new ApiError(`сервер ответил ${status}`, HTTP_ERROR_CODE, status);
}

interface Call {
  method: "GET" | "PUT" | "DELETE";
  path: string;
  token?: string;
  body?: unknown;
}

interface Answer {
  status: number;
  body: unknown;
}

/** Сервер Cyberzavod по HTTP: JSON в обе стороны, токен — в заголовке `Authorization`. */
export class HttpCyberzavodApi implements CyberzavodApi {
  readonly #baseUrl: string;
  readonly #fetch: FetchFunction;

  /**
   * Клиент сервера.
   * @param {string} baseUrl Адрес сервера без завершающего «/».
   * @param {FetchFunction} fetchImplementation Функция запроса; по умолчанию встроенный `fetch`.
   */
  constructor(baseUrl: string, fetchImplementation: FetchFunction = fetch) {
    this.#baseUrl = baseUrl;
    this.#fetch = fetchImplementation;
  }

  /**
   * Спрашивает у сервера идентификатор приложения GitHub.
   * @returns {Promise<string>} `clientId` для device flow.
   * @throws {ApiError} Если вход на сервере недоступен или ответ неожиданный.
   */
  async githubClientId(): Promise<string> {
    const { status, body } = await this.#call({ method: "GET", path: "/api/auth/github" });

    if (!isObject(body) || !isString(body.clientId)) throw invalidResponse("нет clientId", status);

    return body.clientId;
  }

  /**
   * Возвращает автора, которому принадлежит токен.
   * @param {string} token Токен GitHub.
   * @returns {Promise<Me>} Автор с галереей и записями.
   * @throws {ApiError} Если сервер не принял токен или ответ неожиданный.
   */
  async me(token: string): Promise<Me> {
    const { status, body } = await this.#call({ method: "GET", path: "/api/me", token });

    return parseMe(body, status);
  }

  /**
   * Отправляет запись в галерею автора.
   * @param {string} token Токен GitHub.
   * @param {string} id Идентификатор записи.
   * @param {unknown} record Запись, прошедшая проверку ядра.
   * @returns {Promise<UploadedRecording>} Сведения о записи на сервере.
   * @throws {ApiError} Если сервер отклонил запись или ответ неожиданный.
   */
  async uploadRecording(token: string, id: string, record: unknown): Promise<UploadedRecording> {
    const { status, body } = await this.#call({
      method: "PUT",
      path: `/api/me/recordings/${encodeURIComponent(id)}`,
      token,
      body: record,
    });

    if (!isObject(body)) throw invalidResponse("нет сведений о записи", status);

    return {
      recording: parseSummary(body.recording, status),
      isNew: status === NEW_RECORDING_STATUS,
    };
  }

  /**
   * Удаляет запись из галереи автора.
   * @param {string} token Токен GitHub.
   * @param {string} id Идентификатор записи.
   * @returns {Promise<void>} Готово, когда сервер удалил запись.
   * @throws {ApiError} Если записи нет или сервер отказал.
   */
  async deleteRecording(token: string, id: string): Promise<void> {
    await this.#call({
      method: "DELETE",
      path: `/api/me/recordings/${encodeURIComponent(id)}`,
      token,
    });
  }

  /**
   * Открывает или закрывает галерею автора.
   * @param {string} token Токен GitHub.
   * @param {boolean} isPublic Показывать галерею в общем списке.
   * @returns {Promise<void>} Готово, когда сервер применил выбор.
   * @throws {ApiError} Если сервер отказал.
   */
  async setGalleryPublic(token: string, isPublic: boolean): Promise<void> {
    await this.#call({ method: "PUT", path: "/api/me/gallery", token, body: { public: isPublic } });
  }

  async #call({ method, path, token, body }: Call): Promise<Answer> {
    const headers: Record<string, string> = { Accept: "application/json" };

    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await sendRequest(this.#fetch, `${this.#baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const answer = await readJsonBody(response);

    if (!response.ok) throw errorOf(answer, response.status);

    return { status: response.status, body: answer };
  }
}

/**
 * Проверяет, что это ошибка сервера с заданным кодом.
 * @param {unknown} err Пойманная ошибка.
 * @param {string} code Код ошибки сервера.
 * @returns {err is ApiError} true, если это ошибка сервера с таким кодом.
 */
export function isApiError(err: unknown, code: string): err is ApiError {
  return err instanceof ApiError && err.code === code;
}
