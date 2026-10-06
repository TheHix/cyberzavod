import { FACTORY_LAYOUTS, type Aisle } from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import { extendedAisle, laneRects } from "./lane.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

const CORNER: Aisle = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 10, y: 10 },
];

describe("extendedAisle", () => {
  it("продолжает оба крайних отрезка по их направлению", () => {
    const points = extendedAisle(CORNER, 100);

    expect(points).toEqual([
      { x: 0, y: -100 },
      { x: 0, y: 10 },
      { x: 110, y: 10 },
    ]);
  });

  it("не трогает внутренние вершины", () => {
    const points = extendedAisle(CORNER, 5);

    expect(points[1]).toEqual({ x: 0, y: 10 });
  });
});

describe("laneRects", () => {
  it("кладёт прямоугольник вдоль горизонтального отрезка с продолжением за концы", () => {
    const aisle: Aisle = [
      { x: 0, y: 4 },
      { x: 10, y: 4 },
    ];

    const rects = laneRects(aisle, 5, 2);

    expect(rects).toEqual([{ x: -5, y: 2, width: 20, height: 4 }]);
  });

  it("кладёт прямоугольник вдоль вертикального отрезка", () => {
    const aisle: Aisle = [
      { x: 3, y: 0 },
      { x: 3, y: 10 },
    ];

    const rects = laneRects(aisle, 0, 1);

    expect(rects).toEqual([{ x: 2, y: 0, width: 2, height: 10 }]);
  });

  it("перекрывает стык ломаной на полуширину, без щели в углу", () => {
    const [vertical, horizontal] = laneRects(CORNER, 0, 1);

    expect(vertical).toEqual({ x: -1, y: 0, width: 2, height: 11 });
    expect(horizontal).toEqual({ x: -1, y: 9, width: 11, height: 2 });
  });

  it("отклоняет диагональный отрезок", () => {
    const aisle: Aisle = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];

    const act = () => laneRects(aisle, 0, 1);

    expect(act).toThrow(/по диагонали/);
  });

  it.each(FACTORY_LAYOUTS)("принимает проход плана $width×$height", (layout) => {
    const aisle = layout.aisle.map((point) => ({
      x: point.x * PIXELS_PER_UNIT,
      y: point.y * PIXELS_PER_UNIT,
    })) as unknown as Aisle;

    const act = () => laneRects(aisle, 100, 9);

    expect(act).not.toThrow();
  });
});
