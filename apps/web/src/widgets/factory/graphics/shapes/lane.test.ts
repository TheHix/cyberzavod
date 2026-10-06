import { describe, expect, it } from "vitest";
import type { Aisle } from "@cyberzavod/core";
import { extendedAisle, laneDashes, laneEdge } from "./lane.ts";

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

describe("laneEdge", () => {
  it("сдвигает кромку прямого отрезка вбок на заданное расстояние", () => {
    const edge = laneEdge(
      [
        { x: 0, y: 4 },
        { x: 10, y: 4 },
      ],
      1,
    );

    expect(edge).toEqual([
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]);
  });

  it("сводит кромки в углу в одну точку на расстоянии от обоих отрезков", () => {
    const [right, left] = [laneEdge(CORNER, 1), laneEdge(CORNER, -1)];

    expect([right[1], left[1]]).toEqual([
      { x: -1, y: 11 },
      { x: 1, y: 9 },
    ]);
  });
});

describe("laneDashes", () => {
  it("кладёт штрихи вдоль каждого отрезка от его начала", () => {
    const dashes = laneDashes(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 3 },
      ],
      2,
      1,
      0.5,
    );

    const starts = dashes.map(([corner]) => corner);
    expect(starts).toEqual([
      { x: 0, y: -0.25 },
      { x: 3, y: -0.25 },
      { x: 5.25, y: 0 },
    ]);
  });

  it("обрезает последний штрих по концу отрезка", () => {
    const dashes = laneDashes(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      3,
      0.5,
      1,
    );

    expect(dashes.at(-1)?.[1]).toEqual({ x: 4, y: -0.5 });
  });
});
