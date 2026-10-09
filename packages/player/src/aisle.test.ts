import { describe, expect, it } from "vitest";
import { aisleStop, aisleWalk, type Aisle } from "./aisle.ts";

const HORIZONTAL: Aisle = [
  { x: 0, y: 4 },
  { x: 10, y: 4 },
];

const VERTICAL: Aisle = [
  { x: 3, y: 0 },
  { x: 3, y: 10 },
];

// Down by 10, then right by 10: the corner is at (0, 10).
const CORNER: Aisle = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 10, y: 10 },
];

describe("aisleStop", () => {
  it("проецирует точку на горизонтальный отрезок", () => {
    const stop = aisleStop(HORIZONTAL, { x: 6, y: 1 });

    expect(stop).toEqual({ point: { x: 6, y: 4 }, along: 6 });
  });

  it("проецирует точку на вертикальный отрезок", () => {
    const stop = aisleStop(VERTICAL, { x: 1, y: 7 });

    expect(stop).toEqual({ point: { x: 3, y: 7 }, along: 7 });
  });

  it("прижимает точку за концом к концу прохода", () => {
    const stop = aisleStop(HORIZONTAL, { x: 14, y: 0 });

    expect(stop).toEqual({ point: { x: 10, y: 4 }, along: 10 });
  });

  it("берёт ближайший отрезок Г-образного прохода и считает путь через угол", () => {
    const stop = aisleStop(CORNER, { x: 7, y: 8 });

    expect(stop).toEqual({ point: { x: 7, y: 10 }, along: 17 });
  });

  it("при равном расстоянии берёт первый отрезок", () => {
    const stop = aisleStop(CORNER, { x: 5, y: 5 });

    expect(stop).toEqual({ point: { x: 0, y: 5 }, along: 5 });
  });
});

describe("aisleWalk", () => {
  it("на одном отрезке не отдаёт вершин", () => {
    const from = aisleStop(HORIZONTAL, { x: 2, y: 0 });
    const to = aisleStop(HORIZONTAL, { x: 8, y: 0 });

    const walk = aisleWalk(HORIZONTAL, from, to);

    expect(walk).toEqual([]);
  });

  it("отдаёт вершину угла между отрезками", () => {
    const from = aisleStop(CORNER, { x: 3, y: 2 });
    const to = aisleStop(CORNER, { x: 6, y: 12 });

    const walk = aisleWalk(CORNER, from, to);

    expect(walk).toEqual([{ x: 0, y: 10 }]);
  });

  it("в обратную сторону отдаёт вершины в обратном порядке", () => {
    const zigzag: Aisle = [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
    ];
    const start = aisleStop(zigzag, { x: 1, y: 1 });
    const end = aisleStop(zigzag, { x: 4, y: 9 });

    const forward = aisleWalk(zigzag, start, end);
    const backward = aisleWalk(zigzag, end, start);

    expect({ forward, backward }).toEqual({
      forward: [
        { x: 0, y: 5 },
        { x: 5, y: 5 },
      ],
      backward: [
        { x: 5, y: 5 },
        { x: 0, y: 5 },
      ],
    });
  });

  it("не считает вершиной остановку, стоящую в самом углу", () => {
    const from = aisleStop(CORNER, { x: 0, y: 3 });
    const to = aisleStop(CORNER, { x: 0, y: 10 });

    const walk = aisleWalk(CORNER, from, to);

    expect(walk).toEqual([]);
  });
});
