// Чтение полей ответа API. Ответ приходит из сети: каждое поле проверяется, прежде чем попасть
// в типы сайта, и ответ не того вида — ошибка с местом, а не `undefined` в разметке.

import { ApiResponseError } from "./errors.ts";

/** Объект JSON с полями, ещё не проверенными. */
export type JsonObject = Readonly<Record<string, unknown>>;

/**
 * Проверяет, что значение — объект JSON.
 * @param {unknown} value Значение из ответа.
 * @param {string} place Что это, для сообщения об ошибке: `ответ /api/stats`.
 * @returns {JsonObject} То же значение как объект.
 * @throws {ApiResponseError} Если это не объект.
 */
export function objectAt(value: unknown, place: string): JsonObject {
  const isObject = typeof value === "object" && value !== null && !Array.isArray(value);

  if (!isObject) throw new ApiResponseError(`${place}: не объект`);

  return value as JsonObject;
}

/**
 * Читает строковое поле.
 * @param {JsonObject} object Объект из ответа.
 * @param {string} key Имя поля.
 * @param {string} place Что это за объект, для сообщения об ошибке.
 * @returns {string} Значение поля.
 * @throws {ApiResponseError} Если поля нет или оно не строка.
 */
export function stringAt(object: JsonObject, key: string, place: string): string {
  const value = object[key];

  if (typeof value !== "string") throw new ApiResponseError(`${place}: ${key} не строка`);

  return value;
}

/**
 * Читает числовое поле: неотрицательное целое — счётчик.
 * @param {JsonObject} object Объект из ответа.
 * @param {string} key Имя поля.
 * @param {string} place Что это за объект, для сообщения об ошибке.
 * @returns {number} Значение поля.
 * @throws {ApiResponseError} Если поля нет или оно не неотрицательное целое.
 */
export function countAt(object: JsonObject, key: string, place: string): number {
  const value = object[key];
  const isCount = typeof value === "number" && Number.isInteger(value) && value >= 0;

  if (!isCount) throw new ApiResponseError(`${place}: ${key} не неотрицательное целое`);

  return value;
}

/**
 * Читает логическое поле.
 * @param {JsonObject} object Объект из ответа.
 * @param {string} key Имя поля.
 * @param {string} place Что это за объект, для сообщения об ошибке.
 * @returns {boolean} Значение поля.
 * @throws {ApiResponseError} Если поля нет или оно не `true`/`false`.
 */
export function booleanAt(object: JsonObject, key: string, place: string): boolean {
  const value = object[key];

  if (typeof value !== "boolean") throw new ApiResponseError(`${place}: ${key} не true/false`);

  return value;
}

/**
 * Читает поле-массив.
 * @param {JsonObject} object Объект из ответа.
 * @param {string} key Имя поля.
 * @param {string} place Что это за объект, для сообщения об ошибке.
 * @returns {readonly unknown[]} Элементы массива, ещё не проверенные.
 * @throws {ApiResponseError} Если поля нет или оно не массив.
 */
export function arrayAt(object: JsonObject, key: string, place: string): readonly unknown[] {
  const value = object[key];

  if (!Array.isArray(value)) throw new ApiResponseError(`${place}: ${key} не массив`);

  return value as readonly unknown[];
}
