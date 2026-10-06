import { STAGES } from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import { ACTOR_ART } from "./actor-art.ts";
import { CRATE_ART, GLOW_ART, SHADOW_ART } from "./actors.ts";
import {
  ART_LEGEND,
  artSize,
  blankImage,
  clearPixel,
  darker,
  fillRect,
  helmetInks,
  lighter,
  paintArt,
  paletteInks,
  type SpriteArt,
} from "./art.ts";
import { PLAQUE_GLYPHS } from "./glyphs.ts";
import { LAMP_AT, LAMP_OFF_ART, LAMP_ON_ART, MACHINE_ART, MACHINE_WORK_ART } from "./machines.ts";
import { DESK_ART } from "./office.ts";
import { testPalette } from "./test-palette.ts";

const MAX_MACHINE = { width: 40, height: 24 };
const MAX_DESK = { width: 32, height: 20 };
const ACTOR_SIDE = 16;

function inks() {
  return paletteInks(testPalette());
}

function pixelAt(image: ReturnType<typeof blankImage>, column: number, row: number) {
  const at = (row * image.width + column) * 4;
  return [...image.pixels.slice(at, at + 4)];
}

// Все рисунки цеха с подписью: каждый должен краситься без ошибки.
function namedArts(): [string, SpriteArt][] {
  return [
    ...Object.entries(ACTOR_ART).flatMap(([facing, poses]) =>
      Object.entries(poses).map(([pose, art]): [string, SpriteArt] => [
        `человек ${facing} ${pose}`,
        art,
      ]),
    ),
    ...STAGES.map((stage): [string, SpriteArt] => [`станок ${stage}`, MACHINE_ART[stage]]),
    ...STAGES.flatMap((stage) =>
      Object.entries(MACHINE_WORK_ART[stage].frames).map(([beat, art]): [string, SpriteArt] => [
        `работа станка ${stage} ${beat}`,
        art,
      ]),
    ),
    ["стол", DESK_ART],
    ["ящик", CRATE_ART],
    ["свечение", GLOW_ART],
    ["тень", SHADOW_ART],
    ["лампа горит", LAMP_ON_ART],
    ["лампа погасла", LAMP_OFF_ART],
    ...Object.entries(PLAQUE_GLYPHS).map(([letter, art]): [string, SpriteArt] => [
      `буква ${letter}`,
      art,
    ]),
  ];
}

// Прозрачные пиксели рисунка, кроме четырёх срезанных углов: «столбец:строка».
function holesInside(art: SpriteArt): string[] {
  const { width, height } = artSize(art);
  const corners = new Set([
    "0:0",
    `${width - 1}:0`,
    `0:${height - 1}`,
    `${width - 1}:${height - 1}`,
  ]);
  return art.flatMap((line, row) =>
    [...line]
      .map((letter, column) => ({ letter, at: `${column}:${row}` }))
      .filter(({ letter, at }) => ART_LEGEND[letter] === null && !corners.has(at))
      .map(({ at }) => at),
  );
}

describe("paintArt", () => {
  it("раскладывает буквы в RGBA по краскам", () => {
    const palette = testPalette();

    const image = paintArt(["ks"], inks());

    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 1, 255]);
    expect(pixelAt(image, 1, 0)).toEqual([0, 0, palette.skin, 255]);
  });

  it("оставляет точку прозрачной", () => {
    const image = paintArt([".k"], inks());

    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("отклоняет неизвестную букву", () => {
    const act = () => paintArt(["kZ"], inks());

    expect(act).toThrow(/неизвестная буква «Z»/);
  });

  it("отклоняет строки разной длины", () => {
    const act = () => paintArt(["kk", "k"], inks());

    expect(act).toThrow(/строка 1/);
  });

  it("отклоняет пустой рисунок", () => {
    const act = () => paintArt([], inks());

    expect(act).toThrow(/пуст/);
  });

  it.each(namedArts())("красит без ошибки рисунок цеха: %s", (_name, art) => {
    const act = () => paintArt(art, inks());

    expect(act).not.toThrow();
  });
});

describe("ACTOR_ART", () => {
  it("рисует человека кадрами 16×16", () => {
    const sizes = Object.values(ACTOR_ART).flatMap((poses) => Object.values(poses).map(artSize));

    expect(sizes).toHaveLength(30);
    for (const size of sizes) expect(size).toEqual({ width: ACTOR_SIDE, height: ACTOR_SIDE });
  });

  it.each(Object.entries(ACTOR_ART))(
    "рисует каждую позу, кроме stand, не так, как stand: %s",
    (_facing, poses) => {
      const sameAsStand = Object.entries(poses)
        .filter(([pose, art]) => pose !== "stand" && art.join() === poses.stand.join())
        .map(([pose]) => pose);

      expect(sameAsStand).toEqual([]);
    },
  );
});

describe("MACHINE_ART", () => {
  it("держит станки в 40×24", () => {
    const machines = STAGES.map((stage) => artSize(MACHINE_ART[stage]));

    for (const size of machines) {
      expect(size.width).toBeLessThanOrEqual(MAX_MACHINE.width);
      expect(size.height).toBeLessThanOrEqual(MAX_MACHINE.height);
    }
  });

  it.each(STAGES)("не оставляет в корпусе станка %s дыр к полу, кроме углов", (stage) => {
    const holes = holesInside(MACHINE_ART[stage]);

    expect(holes).toEqual([]);
  });
});

describe("MACHINE_WORK_ART", () => {
  const LAMP_SIZE = artSize(LAMP_OFF_ART);

  it.each(STAGES)("рисует кадры работы станка %s одного размера и разными", (stage) => {
    const { workA, workB } = MACHINE_WORK_ART[stage].frames;

    expect(artSize(workA)).toEqual(artSize(workB));
    expect(workA).not.toEqual(workB);
  });

  it.each(STAGES)("кладёт накладку станка %s внутрь его рисунка", (stage) => {
    const { at, frames } = MACHINE_WORK_ART[stage];
    const { width, height } = artSize(frames.workA);
    const machine = artSize(MACHINE_ART[stage]);

    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThanOrEqual(0);
    expect(at.x + width).toBeLessThanOrEqual(machine.width);
    expect(at.y + height).toBeLessThanOrEqual(machine.height);
  });

  it.each(STAGES)("не заводит накладку станка %s на лампу", (stage) => {
    const { at, frames } = MACHINE_WORK_ART[stage];
    const { width, height } = artSize(frames.workA);

    const apartHorizontally = at.x + width <= LAMP_AT.x || LAMP_AT.x + LAMP_SIZE.width <= at.x;
    const apartVertically = at.y + height <= LAMP_AT.y || LAMP_AT.y + LAMP_SIZE.height <= at.y;

    expect(apartHorizontally || apartVertically).toBe(true);
  });
});

describe("DESK_ART", () => {
  it("держит стол в 32×20", () => {
    const size = artSize(DESK_ART);

    expect(size.width).toBeLessThanOrEqual(MAX_DESK.width);
    expect(size.height).toBeLessThanOrEqual(MAX_DESK.height);
  });
});

describe("LAMP_ON_ART", () => {
  it("ставит горящую лампу на место погасшей", () => {
    const [lit, unlit] = [LAMP_ON_ART, LAMP_OFF_ART].map(artSize);

    expect(lit).toEqual(unlit);
  });
});

describe("helmetInks", () => {
  it("даёт каске тень темнее и блик светлее её цвета", () => {
    const inks = helmetInks(0x808080);

    expect(inks.helmet).toBe(0x808080);
    expect(inks.helmetShade).toBeLessThan(0x808080);
    expect(inks.helmetLight).toBeGreaterThan(0x808080);
  });
});

describe("paletteInks", () => {
  it("берёт белый и каску рабочих из палитры", () => {
    const palette = testPalette();

    const inks = paletteInks(palette);

    expect([inks.white, inks.helmet]).toEqual([palette.white, palette.helmet]);
  });
});

describe("fillRect", () => {
  it("закрашивает прямоугольник и отбрасывает часть за краем", () => {
    const image = blankImage(2, 2);

    fillRect(image, 1, 1, 5, 5, 0x010203);

    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(image, 1, 1)).toEqual([1, 2, 3, 255]);
  });
});

describe("clearPixel", () => {
  it("делает закрашенный пиксель прозрачным", () => {
    const image = blankImage(1, 1);
    fillRect(image, 0, 0, 1, 1, 0xffffff);

    clearPixel(image, 0, 0);

    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe("darker", () => {
  it("делает краску темнее", () => {
    const color = darker(0x808080);

    expect(color).toBeLessThan(0x808080);
  });
});

describe("lighter", () => {
  it("делает краску светлее", () => {
    const color = lighter(0x808080);

    expect(color).toBeGreaterThan(0x808080);
  });
});
