import { ApiRequestError, ApiResponseError } from "./errors.ts";

/**
 * API data on a page: still loading, ready, missing (404 or nothing to ask for), a broken
 * response, or a failed request; each outcome has its own message.
 */
export type Remote<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "missing" }
  | { readonly status: "broken" }
  | { readonly status: "failed" };

/** The data is still loading: the page's initial state. */
export const LOADING: Remote<never> = { status: "loading" };

/** There is no data: the API responded 404 or the page address has nothing to ask for. */
export const MISSING: Remote<never> = { status: "missing" };

const NOT_FOUND_STATUS = 404;

function failureOf(err: unknown): Remote<never> {
  if (err instanceof ApiRequestError && err.status === NOT_FOUND_STATUS) return MISSING;

  console.error("данные из API не получены", err);

  return err instanceof ApiResponseError ? { status: "broken" } : { status: "failed" };
}

/**
 * Runs an API request and turns the outcome into a page state: it does not throw an error but
 * names it, so the page can show a clear message.
 * @template T
 * @param {() => Promise<T>} request Request with response parsing.
 * @returns {Promise<Remote<T>>} Ready data or the reason it is missing.
 */
export async function settle<T>(request: () => Promise<T>): Promise<Remote<T>> {
  try {
    return { status: "ready", value: await request() };
  } catch (err) {
    return failureOf(err);
  }
}

/**
 * Ready data, if there is any.
 * @template T
 * @param {Remote<T>} state Data state.
 * @returns {T | undefined} The data, or `undefined` while it cannot be shown.
 */
export function readyValue<T>(state: Remote<T>): T | undefined {
  return state.status === "ready" ? state.value : undefined;
}
