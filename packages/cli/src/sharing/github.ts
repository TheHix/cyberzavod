// Вход через GitHub по device flow: человек подтверждает код в браузере, CLI опрашивает GitHub.
// Само обращение к GitHub — за интерфейсом `GithubDeviceAuth`, чтобы тесты шли без сети.

import { CommandError } from "../errors.ts";
import { isObject, readJsonBody, sendRequest, type FetchFunction } from "./http.ts";

/** Адрес, с которого GitHub выдаёт код устройства. */
export const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";

/** Адрес, на котором GitHub выдаёт токен подтверждённому устройству. */
export const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

/** Код, который человек вводит на странице GitHub, и параметры опроса. */
export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  intervalSeconds: number;
}

/** Ответ GitHub на один опрос: токен выдан, ждать дальше, замедлиться или отказ. */
export type TokenPoll =
  | { status: "granted"; token: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "expired" }
  | { status: "denied" };

/** Обращения к GitHub во время входа. */
export interface GithubDeviceAuth {
  requestDeviceCode(clientId: string): Promise<DeviceCode>;
  pollAccessToken(clientId: string, deviceCode: string): Promise<TokenPoll>;
}

function field(body: Record<string, unknown>, name: string): string {
  const value = body[name];

  if (typeof value !== "string" || value === "") {
    throw new CommandError(`GitHub вернул неожиданный ответ: нет поля ${name}`);
  }

  return value;
}

function seconds(body: Record<string, unknown>, name: string): number {
  const value = body[name];

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new CommandError(`GitHub вернул неожиданный ответ: нет поля ${name}`);
  }

  return value;
}

function parseDeviceCode(body: unknown): DeviceCode {
  if (!isObject(body)) throw new CommandError("GitHub не выдал код устройства");

  return {
    deviceCode: field(body, "device_code"),
    userCode: field(body, "user_code"),
    verificationUri: field(body, "verification_uri"),
    expiresInSeconds: seconds(body, "expires_in"),
    intervalSeconds: seconds(body, "interval"),
  };
}

function parseTokenPoll(body: unknown): TokenPoll {
  if (!isObject(body)) throw new CommandError("GitHub не выдал токен");

  if (typeof body.access_token === "string" && body.access_token !== "") {
    return { status: "granted", token: body.access_token };
  }

  switch (body.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "expired_token":
      return { status: "expired" };
    case "access_denied":
      return { status: "denied" };

    default: {
      const reason = typeof body.error_description === "string" ? body.error_description : "";

      throw new CommandError(`GitHub отклонил вход: ${reason || String(body.error)}`);
    }
  }
}

/** GitHub по HTTP: запросы формой, ответы JSON. */
export class HttpGithubAuth implements GithubDeviceAuth {
  readonly #fetch: FetchFunction;

  /**
   * Клиент device flow GitHub.
   * @param {FetchFunction} fetchImplementation Функция запроса; по умолчанию встроенный `fetch`.
   */
  constructor(fetchImplementation: FetchFunction = fetch) {
    this.#fetch = fetchImplementation;
  }

  /**
   * Просит у GitHub код устройства. Права (scope) не запрашиваются: хватает логина и id.
   * @param {string} clientId Идентификатор приложения GitHub.
   * @returns {Promise<DeviceCode>} Код для человека и параметры опроса.
   * @throws {CommandError} Если GitHub недоступен или ответил неожиданно.
   */
  async requestDeviceCode(clientId: string): Promise<DeviceCode> {
    const body = await this.#post(GITHUB_DEVICE_CODE_URL, { client_id: clientId });

    return parseDeviceCode(body);
  }

  /**
   * Спрашивает у GitHub, подтвердил ли человек код.
   * @param {string} clientId Идентификатор приложения GitHub.
   * @param {string} deviceCode Код устройства из `requestDeviceCode`.
   * @returns {Promise<TokenPoll>} Токен или причина подождать либо отказаться.
   * @throws {CommandError} Если GitHub недоступен или отклонил вход по другой причине.
   */
  async pollAccessToken(clientId: string, deviceCode: string): Promise<TokenPoll> {
    const body = await this.#post(GITHUB_ACCESS_TOKEN_URL, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: DEVICE_CODE_GRANT_TYPE,
    });

    return parseTokenPoll(body);
  }

  async #post(url: string, form: Record<string, string>): Promise<unknown> {
    const response = await sendRequest(this.#fetch, url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });

    return readJsonBody(response);
  }
}
