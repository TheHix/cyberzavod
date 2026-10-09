import { STAGES, type Stage } from "@cyberzavod/core";
import { FACTORY_LAYOUTS, WIDE_LAYOUT, type FactoryLayout } from "@cyberzavod/player";
import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "@/shared/i18n/locale.ts";
import { FOREMAN_LABEL, STAGE_LABELS } from "@/shared/config/stages.ts";
import { ACTOR_FIGURE } from "./actors.ts";
import { artSize } from "./art.ts";
import { MACHINE_SIZE } from "./machines.ts";
import { DESK_ART } from "./office.ts";
import { plaquePlacements, plaqueRect, type PlaquePlacement } from "./plaques.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function rectAround(
  center: { x: number; y: number },
  size: { width: number; height: number },
): Rect {
  return {
    left: center.x - size.width / 2,
    top: center.y - size.height / 2,
    right: center.x + size.width / 2,
    bottom: center.y + size.height / 2,
  };
}

function overlap(a: Rect, b: Rect): boolean {
  const epsilon = 1e-9;

  return (
    a.left < b.right - epsilon &&
    b.left < a.right - epsilon &&
    a.top < b.bottom - epsilon &&
    b.top < a.bottom - epsilon
  );
}

function plaqueRectOf(placement: PlaquePlacement): Rect {
  return rectAround(placement.center, placement.size);
}

function furnitureOf(layout: FactoryLayout): Rect[] {
  const machine = {
    width: MACHINE_SIZE.width / PIXELS_PER_UNIT,
    height: MACHINE_SIZE.height / PIXELS_PER_UNIT,
  };
  const deskSize = artSize(DESK_ART);
  const desk = {
    width: deskSize.width / PIXELS_PER_UNIT,
    height: deskSize.height / PIXELS_PER_UNIT,
  };

  return [
    ...STAGES.map((stage) => rectAround(layout.stations[stage].machine, machine)),
    rectAround(layout.foreman.desk, desk),
  ];
}

function figureRectsOf(layout: FactoryLayout): Rect[] {
  const stations = STAGES.map((stage) => layout.stations[stage]);
  const points = [
    ...stations.map(({ post }) => post),
    ...stations.map(({ foremanPost }) => foremanPost),
    layout.foreman.post,
    layout.foreman.door,
  ];
  const { left, top, right, bottom } = ACTOR_FIGURE;

  return points.map((point) => ({
    left: point.x + left / PIXELS_PER_UNIT,
    top: point.y + top / PIXELS_PER_UNIT,
    right: point.x + right / PIXELS_PER_UNIT,
    bottom: point.y + bottom / PIXELS_PER_UNIT,
  }));
}

interface PlanCase {
  readonly locale: Locale;
  readonly layout: FactoryLayout;
  readonly width: number;
  readonly height: number;
}

// Every floor plan in every language: plaque width depends on the language.
const PLAN_CASES: readonly PlanCase[] = LOCALES.flatMap((locale) =>
  FACTORY_LAYOUTS.map((layout) => ({
    locale,
    layout,
    width: layout.width,
    height: layout.height,
  })),
);

// The gap between figures in a row is this fraction of the plaque width: the plaque does not fit
// there.
const NARROWER_THAN_PLAQUE = 0.9;

// Foreman spots at all machines are in a row on the stage plaque, gaps slightly narrower than the
// plaque: moving off one figure pushes it into the next, and it jumps between them.
function rowOfFiguresOnPlaque(layout: FactoryLayout, stage: Stage, locale: Locale): FactoryLayout {
  const plaque = plaquePlacements(layout, locale)[STAGES.indexOf(stage)];

  if (plaque === undefined) throw new Error(`у этапа ${stage} нет таблички`);

  const figureWidth = (ACTOR_FIGURE.right - ACTOR_FIGURE.left) / PIXELS_PER_UNIT;
  const spacing = figureWidth + plaque.size.width * NARROWER_THAN_PLAQUE;
  const middle = Math.floor(STAGES.length / 2);
  const stations = Object.fromEntries(
    STAGES.map((each, index) => [
      each,
      {
        ...layout.stations[each],
        foremanPost: { x: plaque.center.x + (index - middle) * spacing, y: plaque.center.y },
      },
    ]),
  ) as FactoryLayout["stations"];

  return { ...layout, stations };
}

describe("plaquePlacements", () => {
  it.each(PLAN_CASES)(
    "ставит табличку каждому станку и кабинету (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const placements = plaquePlacements(layout, locale);

      expect(placements.map(({ text }) => text)).toEqual([
        ...STAGES.map((stage) => STAGE_LABELS[stage][locale]),
        FOREMAN_LABEL[locale],
      ]);
    },
  );

  it.each(PLAN_CASES)(
    "не пересекает таблички друг с другом (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const rects = plaquePlacements(layout, locale).map(plaqueRectOf);

      const crossings = rects.flatMap((rect, index) =>
        rects.slice(index + 1).filter((other) => overlap(rect, other)),
      );

      expect(crossings).toEqual([]);
    },
  );

  it.each(PLAN_CASES)(
    "не пересекает таблички со станками и столом (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const furniture = furnitureOf(layout);

      const crossings = plaquePlacements(layout, locale)
        .map(plaqueRectOf)
        .flatMap((rect) => furniture.filter((piece) => overlap(rect, piece)));

      expect(crossings).toEqual([]);
    },
  );

  it.each(PLAN_CASES)(
    "ставит табличку по другую сторону станка от рабочего (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const placements = plaquePlacements(layout, locale);

      for (const [index, stage] of STAGES.entries()) {
        const { machine, post } = layout.stations[stage];
        const plaqueY = placements[index]?.center.y ?? NaN;

        expect(Math.sign(plaqueY - machine.y)).toBe(-Math.sign(post.y - machine.y));
      }
    },
  );

  it.each(PLAN_CASES)(
    "ставит табличку кабинета за местом мастера (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const { desk, post } = layout.foreman;

      const placement = plaquePlacements(layout, locale).at(-1);

      expect(Math.sign((placement?.center.y ?? NaN) - post.y)).toBe(Math.sign(post.y - desk.y));
    },
  );

  it.each(PLAN_CASES)(
    "не пересекает таблички с мастером и рабочими во всех их точках (план $width×$height, $locale)",
    ({ locale, layout }) => {
      const figures = figureRectsOf(layout);

      const crossings = plaquePlacements(layout, locale)
        .map(plaqueRectOf)
        .flatMap((rect) => figures.filter((figure) => overlap(rect, figure)));

      expect(crossings).toEqual([]);
    },
  );

  it("сдвигает табличку вдоль ряда, а не по вертикали, когда на ней стоит мастер", () => {
    const [layout] = FACTORY_LAYOUTS;
    const stage = STAGES[0] ?? "planning";
    const station = layout.stations[stage];
    const crowded = {
      ...layout,
      stations: {
        ...layout.stations,
        [stage]: { ...station, foremanPost: { x: station.machine.x, y: station.machine.y - 1 } },
      },
    };
    const [original] = plaquePlacements(layout, "ru");

    const [moved] = plaquePlacements(crowded, "ru");

    expect(moved?.center.y).toBeCloseTo(original?.center.y ?? NaN);
    expect(moved?.center.x).not.toBeCloseTo(original?.center.x ?? NaN);
  });

  it("отказывает, если табличке негде встать между фигурами", () => {
    const layout = rowOfFiguresOnPlaque(WIDE_LAYOUT, "planning", "ru");

    const act = () => plaquePlacements(layout, "ru");

    expect(act).toThrow(`табличка «${STAGE_LABELS.planning.ru}» не помещается между фигурами`);
  });
});

describe("plaqueRect", () => {
  it("даёт целые пиксели рисунка и тот же размер, что у таблички", () => {
    const placement = { text: "Код", center: { x: 3.1, y: 2.2 }, size: { width: 1, height: 0.5 } };

    const rect = plaqueRect(placement);

    expect(rect).toEqual({ x: 42, y: 31, width: 16, height: 8 });
  });
});
