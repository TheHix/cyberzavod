import { ApiRequestError, ApiResponseError } from "./errors.ts";

/**
 * Данные из API на странице: ещё грузятся, готовы, их нет (404 или нечего спрашивать), ответ
 * битый или запрос не удался — у каждого исхода своё сообщение.
 */
export type Remote<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "missing" }
  | { readonly status: "broken" }
  | { readonly status: "failed" };

/** Данные ещё грузятся: начальное состояние страницы. */
export const LOADING: Remote<never> = { status: "loading" };

/** Данных нет: API ответил 404 или в адресе страницы нечего спрашивать. */
export const MISSING: Remote<never> = { status: "missing" };

const NOT_FOUND_STATUS = 404;

function failureOf(err: unknown): Remote<never> {
  if (err instanceof ApiRequestError && err.status === NOT_FOUND_STATUS) return MISSING;

  console.error("данные из API не получены", err);

  return err instanceof ApiResponseError ? { status: "broken" } : { status: "failed" };
}

/**
 * Выполняет запрос к API и превращает исход в состояние страницы: ошибку не бросает, а
 * называет, чтобы страница показала понятное сообщение.
 * @template T
 * @param {() => Promise<T>} request Запрос с разбором ответа.
 * @returns {Promise<Remote<T>>} Готовые данные или причина, почему их нет.
 */
export async function settle<T>(request: () => Promise<T>): Promise<Remote<T>> {
  try {
    return { status: "ready", value: await request() };
  } catch (err) {
    return failureOf(err);
  }
}

/**
 * Готовые данные, если они есть.
 * @template T
 * @param {Remote<T>} state Состояние данных.
 * @returns {T | undefined} Данные или `undefined`, пока их нельзя показать.
 */
export function readyValue<T>(state: Remote<T>): T | undefined {
  return state.status === "ready" ? state.value : undefined;
}
