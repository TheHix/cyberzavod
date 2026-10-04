import type { Recording } from "@cyberzavod/core";

/**
 * Порядок записей в списке: начатые позже — первыми.
 * @param {Recording} a Первая запись.
 * @param {Recording} b Вторая запись.
 * @returns {number} Отрицательное число, если `a` идёт раньше `b`.
 */
export function newestFirst(a: Recording, b: Recording): number {
  // Время в ISO 8601 по UTC сравнивается как строка; при равном времени порядок задаёт id.
  return b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id);
}
