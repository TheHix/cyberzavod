// Сервер Cyberzavod: интерфейс, которым пользуются команды, и его реализация поверх HTTP.
// Формат ответов — контракт API; всё, что пришло по сети, проверяется до того, как его получат команды.

import { CommandError } from "../errors.ts";
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
   * @param {string} message Текст ошибки из ответа сервера, как он пришёл: язык выбирает сервер.
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

const RESPONSE_BODY = "body";

// Поле названо путём по JSON сервера: оно одинаково на любом языке сообщений.
function invalidResponse(field: string): CommandError {
  return new CommandError((messages) => messages.errors.serverUnexpectedResponse(field));
}

// `where` — путь к записи в ответе: по нему видно, какое именно поле сервер не прислал.
function parseSummary(raw: unknown, where: string): RecordingSummary {
  if (!isObject(raw)) throw invalidResponse(where);

  const { id, slug, projectId, title, language, startedAt, uploadedAt } = raw;

  if (!isString(id)) throw invalidResponse(`${where}.id`);
  if (!isString(slug)) throw invalidResponse(`${where}.slug`);
  if (!isString(projectId)) throw invalidResponse(`${where}.projectId`);
  if (!isString(title)) throw invalidResponse(`${where}.title`);
  if (!isString(language)) throw invalidResponse(`${where}.language`);
  if (!isString(startedAt)) throw invalidResponse(`${where}.startedAt`);
  if (!isString(uploadedAt)) throw invalidResponse(`${where}.uploadedAt`);

  return { id, slug, projectId, title, language, startedAt, uploadedAt };
}

function parseMe(raw: unknown): Me {
  if (!isObject(raw)) throw invalidResponse(RESPONSE_BODY);

  const { login, galleryPublic, limit, recordings } = raw;

  if (!isString(login)) throw invalidResponse("login");
  if (typeof galleryPublic !== "boolean") throw invalidResponse("galleryPublic");
  if (typeof limit !== "number") throw invalidResponse("limit");
  if (!Array.isArray(recordings)) throw invalidResponse("recordings");

  const summaries = recordings.map((summary: unknown) => parseSummary(summary, "recordings[]"));

  return { login, galleryPublic, limit, recordings: summaries };
}

// Сервер Cyberzavod отвечает ошибкой `{error, message}`; ответ без неё — не его ошибка, а сбой
// по дороге, и текст о нём пишет CLI.
function errorOf(body: unknown, status: number): ApiError | CommandError {
  if (isObject(body) && isString(body.error) && isString(body.message)) {
    return new ApiError(body.message, body.error, status);
  }

  return new CommandError((messages) => messages.errors.serverStatus(status));
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
   * @throws {ApiError} Если вход на сервере недоступен.
   * @throws {CommandError} Если ответ неожиданный.
   */
  async githubClientId(): Promise<string> {
    const { body } = await this.#call({ method: "GET", path: "/api/auth/github" });

    if (!isObject(body) || !isString(body.clientId)) throw invalidResponse("clientId");

    return body.clientId;
  }

  /**
   * Возвращает автора, которому принадлежит токен.
   * @param {string} token Токен GitHub.
   * @returns {Promise<Me>} Автор с галереей и записями.
   * @throws {ApiError} Если сервер не принял токен.
   * @throws {CommandError} Если ответ неожиданный.
   */
  async me(token: string): Promise<Me> {
    const { body } = await this.#call({ method: "GET", path: "/api/me", token });

    return parseMe(body);
  }

  /**
   * Отправляет запись в галерею автора.
   * @param {string} token Токен GitHub.
   * @param {string} id Идентификатор записи.
   * @param {unknown} record Запись, прошедшая проверку ядра.
   * @returns {Promise<UploadedRecording>} Сведения о записи на сервере.
   * @throws {ApiError} Если сервер отклонил запись.
   * @throws {CommandError} Если ответ неожиданный.
   */
  async uploadRecording(token: string, id: string, record: unknown): Promise<UploadedRecording> {
    const { status, body } = await this.#call({
      method: "PUT",
      path: `/api/me/recordings/${encodeURIComponent(id)}`,
      token,
      body: record,
    });

    if (!isObject(body)) throw invalidResponse(RESPONSE_BODY);

    return {
      recording: parseSummary(body.recording, "recording"),
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
