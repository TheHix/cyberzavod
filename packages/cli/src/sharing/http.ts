// Общее для обращений в сеть: встроенный `fetch` Node, который в тестах заменяется заглушкой.

import { CommandError } from "../errors.ts";

/** Функция запроса: встроенный `fetch` или заглушка в тесте. */
export type FetchFunction = typeof fetch;

/** Параметры запроса: метод, заголовки, тело. */
export type RequestOptions = NonNullable<Parameters<FetchFunction>[1]>;

/**
 * Отправляет запрос; сбой сети превращает в ошибку команды с адресом, а не в трассу стека.
 * @param {FetchFunction} fetchImplementation Функция запроса.
 * @param {string} url Адрес запроса.
 * @param {RequestOptions} init Параметры запроса.
 * @returns {Promise<Response>} Ответ сервера, любого статуса.
 * @throws {CommandError} Если до сервера не удалось достучаться.
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
 * Читает тело ответа как JSON.
 * @param {Response} response Ответ сервера.
 * @returns {Promise<unknown>} Разобранный JSON или undefined, если тело пустое или не JSON.
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
 * Проверяет, что значение — объект с полями.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is Record<string, unknown>} true, если это объект, а не массив и не null.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
