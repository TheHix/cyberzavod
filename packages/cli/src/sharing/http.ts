// Shared network access: Node's built-in `fetch`, replaced by a stub in tests.

import { CommandError } from "../errors.ts";

/** Request function: the built-in `fetch` or a stub in a test. */
export type FetchFunction = typeof fetch;

/** Request parameters: method, headers, body. */
export type RequestOptions = NonNullable<Parameters<FetchFunction>[1]>;

/**
 * Sends a request; turns a network failure into a command error with the address, not a stack
 * trace.
 * @param {FetchFunction} fetchImplementation Request function.
 * @param {string} url Request address.
 * @param {RequestOptions} init Request parameters.
 * @returns {Promise<Response>} Server response of any status.
 * @throws {CommandError} If the server could not be reached.
 */
export async function sendRequest(
  fetchImplementation: FetchFunction,
  url: string,
  init: RequestOptions,
): Promise<Response> {
  try {
    return await fetchImplementation(url, init);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    const { origin } = new URL(url);

    throw new CommandError((messages) => messages.errors.noConnection({ origin, reason }), {
      cause: err,
    });
  }
}

/**
 * Reads the response body as JSON.
 * @param {Response} response Server response.
 * @returns {Promise<unknown>} Parsed JSON, or undefined if the body is empty or not JSON.
 */
export async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim() === "") return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Checks that the value is an object with fields.
 * @param {unknown} value The value to check.
 * @returns {value is Record<string, unknown>} true if it is an object, not an array and not null.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
