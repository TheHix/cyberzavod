import type { GuideMeta } from "./guide.ts";

type Ordered = Pick<GuideMeta, "id" | "order">;

/**
 * Guide order in the list: by `order`, on a tie by id.
 * @param {Ordered} a First guide.
 * @param {Ordered} b Second guide.
 * @returns {number} A negative number if `a` comes before `b`.
 */
export function byGuideOrder(a: Ordered, b: Ordered): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}
