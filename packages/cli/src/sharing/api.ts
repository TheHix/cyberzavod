// The Cyberzavod server: the interface the commands use and its implementation over HTTP. The
// response format is the API contract; everything from the network is validated before commands get
// it.

import { CommandError } from "../errors.ts";
import { isObject, readJsonBody, sendRequest, type FetchFunction } from "./http.ts";

/** Brief information about an author's recording on the server. */
export interface RecordingSummary {
  id: string;
  slug: string;
  projectId: string;
  title: string;
  language: string;
  startedAt: string;
  uploadedAt: string;
}

/** An author, their gallery and recordings. */
export interface Me {
  login: string;
  galleryPublic: boolean;
  limit: number;
  recordings: RecordingSummary[];
}

/** Result of sending a recording. */
export interface UploadedRecording {
  recording: RecordingSummary;
  /** The recording appeared for the first time rather than replacing an earlier one. */
  isNew: boolean;
}

/** A server error: the code and text from its response. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  /**
   * An error reported by the server.
   * @param {string} message Error text from the server response, as it came: the server picks the
   *   language.
   * @param {string} code Error code from the server response, for example `limit_reached`.
   * @param {number} status HTTP status of the response.
   */
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Server error code when it did not accept the token. */
export const UNAUTHORIZED_CODE = "unauthorized";

/** Server error code when the author already has the maximum number of recordings. */
export const LIMIT_REACHED_CODE = "limit_reached";

const NEW_RECORDING_STATUS = 201;

/** What the commands take from the server; author requests carry a GitHub token. */
export interface CyberzavodApi {
  /** Id of the GitHub app used for login. */
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

// The field is named by its path in the server JSON: it is the same in any message language.
function invalidResponse(field: string): CommandError {
  return new CommandError((messages) => messages.errors.serverUnexpectedResponse(field));
}

// `where` is the path to the value in the response: it shows exactly which field the server did not
// send.
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

// The Cyberzavod server responds with an `{error, message}` error; a response without it is not its
// error but a failure along the way, and the CLI writes the text about it.
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

/** The Cyberzavod server over HTTP: JSON both ways, the token in the `Authorization` header. */
export class HttpCyberzavodApi implements CyberzavodApi {
  readonly #baseUrl: string;
  readonly #fetch: FetchFunction;

  /**
   * Server client.
   * @param {string} baseUrl Server address without a trailing "/".
   * @param {FetchFunction} fetchImplementation Request function; the built-in `fetch` by default.
   */
  constructor(baseUrl: string, fetchImplementation: FetchFunction = fetch) {
    this.#baseUrl = baseUrl;
    this.#fetch = fetchImplementation;
  }

  /**
   * Asks the server for the GitHub app id.
   * @returns {Promise<string>} `clientId` for the device flow.
   * @throws {ApiError} If login is unavailable on the server.
   * @throws {CommandError} If the response is unexpected.
   */
  async githubClientId(): Promise<string> {
    const { body } = await this.#call({ method: "GET", path: "/api/auth/github" });

    if (!isObject(body) || !isString(body.clientId)) throw invalidResponse("clientId");

    return body.clientId;
  }

  /**
   * Returns the author the token belongs to.
   * @param {string} token GitHub token.
   * @returns {Promise<Me>} The author with their gallery and recordings.
   * @throws {ApiError} If the server did not accept the token.
   * @throws {CommandError} If the response is unexpected.
   */
  async me(token: string): Promise<Me> {
    const { body } = await this.#call({ method: "GET", path: "/api/me", token });

    return parseMe(body);
  }

  /**
   * Sends a recording to the author's gallery.
   * @param {string} token GitHub token.
   * @param {string} id Recording id.
   * @param {unknown} record A record that passed the core's validation.
   * @returns {Promise<UploadedRecording>} Information about the recording on the server.
   * @throws {ApiError} If the server rejected the recording.
   * @throws {CommandError} If the response is unexpected.
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
   * Removes a recording from the author's gallery.
   * @param {string} token GitHub token.
   * @param {string} id Recording id.
   * @returns {Promise<void>} Done when the server has removed the recording.
   * @throws {ApiError} If there is no such recording or the server refused.
   */
  async deleteRecording(token: string, id: string): Promise<void> {
    await this.#call({
      method: "DELETE",
      path: `/api/me/recordings/${encodeURIComponent(id)}`,
      token,
    });
  }

  /**
   * Opens or closes the author's gallery.
   * @param {string} token GitHub token.
   * @param {boolean} isPublic Show the gallery in the public list.
   * @returns {Promise<void>} Done when the server has applied the choice.
   * @throws {ApiError} If the server refused.
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
 * Checks that this is a server error with the given code.
 * @param {unknown} err The caught error.
 * @param {string} code Server error code.
 * @returns {err is ApiError} true if this is a server error with that code.
 */
export function isApiError(err: unknown, code: string): err is ApiError {
  return err instanceof ApiError && err.code === code;
}
