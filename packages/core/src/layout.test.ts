import { describe, expect, it } from "vitest";
import { aisleStop } from "./aisle.ts";
import {
  FACTORY_LAYOUTS,
  PORTRAIT_LAYOUT,
  WIDE_LAYOUT,
  distance,
  layoutFor,
  stopShortOf,
  type FactoryLayout,
  type Point,
} from "./layout.ts";
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

function pointsOf(layout: FactoryLayout): Point[] {
  const { stations, foreman, aisle } = layout;
  const stationPoints = STAGES.flatMap((stage) => {
    const { machine, post, foremanPost } = stations[stage];
    return [machine, post, foremanPost];
  });
  return [...stationPoints, foreman.desk, foreman.post, foreman.door, ...aisle];
}

function distanceToSegment(point: Point, from: Point, to: Point): number {
  const length = distance(from, to);
  if (length === 0) return distance(point, from);
  const share =
    ((point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y)) / length ** 2;
  const clamped = Math.min(1, Math.max(0, share));
  return distance(point, {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped,
  });
}

describe.each(
  FACTORY_LAYOUTS.map((layout) => ({ name: `${layout.width}×${layout.height}`, layout })),
)("план $name", ({ layout }) => {
  it("держит все точки и вершины прохода внутри пола", () => {
    const outside = pointsOf(layout).filter(
      ({ x, y }) => x < 0 || x > layout.width || y < 0 || y > layout.height,
    );

    expect(outside).toEqual([]);
  });

  it.each(STAGES)("ставит место мастера у станка %s вне пути детали к проходу", (stage) => {
    const { post, foremanPost } = layout.stations[stage];
    const entry = aisleStop(layout.aisle, post).point;

    const gap = distanceToSegment(foremanPost, post, entry);

    expect(gap).toBeGreaterThanOrEqual(DEFAULT_PACING.handoffGap);
  });
});

describe("layoutFor", () => {
  it("отдаёт портретный план полю телефона 351×487", () => {
    const layout = layoutFor(351, 487);

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it.each([
    [872, 860],
    [1332, 1040],
  ])("оставляет широкий план полю %i×%i", (width, height) => {
    const layout = layoutFor(width, height);

    expect(layout).toBe(WIDE_LAYOUT);
  });

  it("отдаёт самый узкий план полю без площади", () => {
    const layout = layoutFor(0, 0);

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it("отдаёт последний план, когда не подходит ни один", () => {
    const first = { ...WIDE_LAYOUT, minFieldAspect: 5 };
    const last = { ...PORTRAIT_LAYOUT, minFieldAspect: 3 };

    const layout = layoutFor(100, 100, [first, last]);

    expect(layout).toBe(last);
  });

  it("берёт широкий план на самой границе соотношения", () => {
    const layout = layoutFor(WIDE_LAYOUT.minFieldAspect * 100, 100);

    expect(layout).toBe(WIDE_LAYOUT);
  });

  it("берёт первый подходящий план из переданных", () => {
    const first = { ...PORTRAIT_LAYOUT, minFieldAspect: 0 };
    const second = { ...PORTRAIT_LAYOUT, minFieldAspect: 0 };

    const layout = layoutFor(100, 100, [first, second]);

    expect(layout).toBe(first);
  });
});
