import { describe, expect, it } from "vitest";
import type { GuideMeta } from "./guide.ts";
import { byGuideOrder } from "./order.ts";

function guideOf(id: string, order: number): GuideMeta {
  return { id, title: `Гайд ${id}`, description: "Описание", order };
}

describe("byGuideOrder", () => {
  it("сортирует по order по возрастанию", () => {
    const guides = [guideOf("a", 3), guideOf("b", 1), guideOf("c", 2)];

    const ids = guides.sort(byGuideOrder).map((guide) => guide.id);

    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("при равном order сортирует по id", () => {
    const guides = [guideOf("zeta", 1), guideOf("alpha", 1), guideOf("first", 0)];

    const ids = guides.sort(byGuideOrder).map((guide) => guide.id);

    expect(ids).toEqual(["first", "alpha", "zeta"]);
  });
});
