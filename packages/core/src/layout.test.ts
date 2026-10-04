import { describe, expect, it } from "vitest";
import { stopShortOf } from "./layout.ts";

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
