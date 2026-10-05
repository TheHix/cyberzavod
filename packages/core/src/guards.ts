// Общие предикаты формата: записи и карточки проекта приходят извне и проверяются одинаково.
// Из пакета не экспортируются.

/**
 * Проверяет, что значение — объект (не `null`): разобранный JSON, который можно читать по полям.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is Record<string, unknown>} true, если это объект.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Проверяет, что значение — строка для показа в одну строку: в заголовке, в карточке промпта.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если строка непустая и без переводов строки.
 */
export function isLine(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/[\r\n]/.test(value);
}
