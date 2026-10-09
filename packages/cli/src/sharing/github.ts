// Login through GitHub with the device flow: the human confirms the code in the browser, the CLI
// polls GitHub. The GitHub calls themselves sit behind the `GithubDeviceAuth` interface so that
// tests run without the network.

import { CommandError } from "../errors.ts";
import { isObject, readJsonBody, sendRequest, type FetchFunction } from "./http.ts";

/** The address from which GitHub issues a device code. */
export const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";

/** The address at which GitHub issues a token to a confirmed device. */
export const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

/** The code the human enters on the GitHub page, and the polling parameters. */
export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  intervalSeconds: number;
}

/** GitHub's answer to one poll: token issued, keep waiting, slow down, or refusal. */
export type TokenPoll =
  | { status: "granted"; token: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "expired" }
  | { status: "denied" };

/** Calls to GitHub during login. */
export interface GithubDeviceAuth {
  requestDeviceCode(clientId: string): Promise<DeviceCode>;
  pollAccessToken(clientId: string, deviceCode: string): Promise<TokenPoll>;
}

function field(body: Record<string, unknown>, name: string): string {
  const value = body[name];

  if (typeof value !== "string" || value === "") {
    throw new CommandError((messages) => messages.errors.githubUnexpectedField(name));
  }

  return value;
}

function seconds(body: Record<string, unknown>, name: string): number {
  const value = body[name];

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new CommandError((messages) => messages.errors.githubUnexpectedField(name));
  }

  return value;
}

function parseDeviceCode(body: unknown): DeviceCode {
  if (!isObject(body)) throw new CommandError((messages) => messages.errors.githubNoDeviceCode);

  return {
    deviceCode: field(body, "device_code"),
    userCode: field(body, "user_code"),
    verificationUri: field(body, "verification_uri"),
    expiresInSeconds: seconds(body, "expires_in"),
    intervalSeconds: seconds(body, "interval"),
  };
}

function parseTokenPoll(body: unknown): TokenPoll {
  if (!isObject(body)) throw new CommandError((messages) => messages.errors.githubNoToken);

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
      const description = typeof body.error_description === "string" ? body.error_description : "";
      const reason = description || String(body.error);

      throw new CommandError((messages) => messages.errors.githubRejected(reason));
    }
  }
}

/** GitHub over HTTP: form requests, JSON responses. */
export class HttpGithubAuth implements GithubDeviceAuth {
  readonly #fetch: FetchFunction;

  /**
   * GitHub device flow client.
   * @param {FetchFunction} fetchImplementation Request function; the built-in `fetch` by default.
   */
  constructor(fetchImplementation: FetchFunction = fetch) {
    this.#fetch = fetchImplementation;
  }

  /**
   * Asks GitHub for a device code. No permissions (scope) are requested: login and id are enough.
   * @param {string} clientId GitHub app id.
   * @returns {Promise<DeviceCode>} The code for the human and the polling parameters.
   * @throws {CommandError} If GitHub is unavailable or answered unexpectedly.
   */
  async requestDeviceCode(clientId: string): Promise<DeviceCode> {
    const body = await this.#post(GITHUB_DEVICE_CODE_URL, { client_id: clientId });

    return parseDeviceCode(body);
  }

  /**
   * Asks GitHub whether the human has confirmed the code.
   * @param {string} clientId GitHub app id.
   * @param {string} deviceCode Device code from `requestDeviceCode`.
   * @returns {Promise<TokenPoll>} The token, or a reason to wait or give up.
   * @throws {CommandError} If GitHub is unavailable or rejected the login for another reason.
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
