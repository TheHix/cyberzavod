import { describe, expect, it } from "vitest";
import { interventionAnchor } from "./anchor.ts";

describe("interventionAnchor", () => {
  it("нумерует якоря с единицы", () => {
    const anchors = [0, 1, 11].map(interventionAnchor);

    expect(anchors).toEqual(["intervention-1", "intervention-2", "intervention-12"]);
  });
});
