import type { GuideMeta } from "./guide.ts";

/**
 * Порядок гайдов в списке: по `order`, при равном — по id.
 * @param {GuideMeta} a Первый гайд.
 * @param {GuideMeta} b Второй гайд.
 * @returns {number} Отрицательное число, если `a` идёт раньше `b`.
 */
export function byGuideOrder(a: GuideMeta, b: GuideMeta): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}
