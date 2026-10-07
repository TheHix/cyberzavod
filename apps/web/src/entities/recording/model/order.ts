import type { SessionRecord } from "@cyberzavod/core";

/**
 * Порядок записей в списке: начатые позже — первыми.
 * @param {SessionRecord} a Первая запись.
 * @param {SessionRecord} b Вторая запись.
 * @returns {number} Отрицательное число, если `a` идёт раньше `b`.
 */
export function newestFirst(a: SessionRecord, b: SessionRecord): number {
  // Время в ISO 8601 по UTC сравнивается как строка; при равном времени порядок задаёт id.
  return b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id);
}
