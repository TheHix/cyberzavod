import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, stopShortOf } from "./layout.ts";
import { STAGES } from "./recording.ts";
import { DEFAULT_PACING } from "./script.ts";

describe("stopShortOf", () => {
  it("останавливается, не доходя до цели заданное расстояние", () => {
    const point = stopShortOf({ x: 0, y: 0 }, { x: 0, y: 10 }, 1);

    expect(point).toEqual({ x: 0, y: 9 });
  });

  it("остаётся на месте, если цель ближе этого расстояния", () => {
    const point = stopShortOf({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 1);

    expect(point).toEqual({ x: 0, y: 0 });
  });
});

describe("DEFAULT_LAYOUT", () => {
  it.each(STAGES)("ставит место мастера у станка %s сбоку от пути детали", (stage) => {
    const { post, foremanPost } = DEFAULT_LAYOUT.stations[stage];

    const gap = Math.abs(foremanPost.x - post.x);

    // Деталь идёт по вертикали через post.x и по проходу, а встреча — перед получателем.
    expect({
      aside: gap >= DEFAULT_PACING.handoffGap,
      offAisle: foremanPost.y !== DEFAULT_LAYOUT.aisle,
    }).toEqual({
      aside: true,
      offAisle: true,
    });
  });
});
