import type { GuideMeta } from "./guide.ts";

type Ordered = Pick<GuideMeta, "id" | "order">;

/**
 * Порядок гайдов в списке: по `order`, при равном — по id.
 * @param {Ordered} a Первый гайд.
 * @param {Ordered} b Второй гайд.
 * @returns {number} Отрицательное число, если `a` идёт раньше `b`.
 */
export function byGuideOrder(a: Ordered, b: Ordered): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}
