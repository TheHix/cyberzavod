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
import { STAGES } from "./stage.ts";
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

const DESKTOP_SCREEN = { width: 1440, height: 900 };

describe("layoutFor", () => {
  it("отдаёт портретный план полю телефона 351×487", () => {
    const layout = layoutFor({ width: 351, height: 487 }, { width: 375, height: 667 });

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it("отдаёт портретный план почти квадратному полю на портретном экране iPhone в Safari", () => {
    const layout = layoutFor({ width: 406, height: 421 }, { width: 430, height: 739 });

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it.each([
    [872, 860, 1440, 900],
    [1332, 1040, 1920, 1080],
    [496, 215, 740, 360],
    [596, 215, 844, 390],
    [700, 245, 932, 430],
  ])(
    "оставляет широкий план полю %i×%i на экране %i×%i",
    (width, height, screenWidth, screenHeight) => {
      const layout = layoutFor({ width, height }, { width: screenWidth, height: screenHeight });

      expect(layout).toBe(WIDE_LAYOUT);
    },
  );

  it("отдаёт портретный план узкому полю на альбомном экране", () => {
    const layout = layoutFor({ width: 456, height: 728 }, { width: 1024, height: 768 });

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it.each([
    ["поля", { width: 0, height: 0 }, DESKTOP_SCREEN],
    ["экрана", { width: 872, height: 860 }, { width: 0, height: 0 }],
  ])("отдаёт самый узкий план без площади %s", (_case, field, screen) => {
    const layout = layoutFor(field, screen);

    expect(layout).toBe(PORTRAIT_LAYOUT);
  });

  it("отдаёт последний план, когда не подходит ни один", () => {
    const first = { ...WIDE_LAYOUT, minFieldAspect: 5 };
    const last = { ...PORTRAIT_LAYOUT, minFieldAspect: 3 };

    const layout = layoutFor({ width: 100, height: 100 }, DESKTOP_SCREEN, [first, last]);

    expect(layout).toBe(last);
  });

  it("берёт широкий план на самой границе обоих соотношений", () => {
    const field = { width: WIDE_LAYOUT.minFieldAspect * 100, height: 100 };
    const screen = { width: WIDE_LAYOUT.minScreenAspect * 100, height: 100 };

    const layout = layoutFor(field, screen);

    expect(layout).toBe(WIDE_LAYOUT);
  });

  it("берёт первый подходящий план из переданных", () => {
    const first = { ...PORTRAIT_LAYOUT, minFieldAspect: 0 };
    const second = { ...PORTRAIT_LAYOUT, minFieldAspect: 0 };

    const layout = layoutFor({ width: 100, height: 100 }, DESKTOP_SCREEN, [first, second]);

    expect(layout).toBe(first);
  });
});
