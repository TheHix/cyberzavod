// Станки: у каждого этапа свой рисунок 40×20 — корпус цвета этапа с тёмной передней гранью и
// декором на крышке (чертёж, терминал, пробирки, лупа, конвейер). Подвижное — отдельные спрайты:
// накладки работы (показана одна, пока рабочий бьёт у станка), лампа погасшая всегда
// на месте, горящая появляется, пока станок держит деталь. Остальное в кадре не меняется.

import type { Stage, StationPlan } from "@cyberzavod/core";
import { Container, Sprite } from "pixi.js";
import {
  artSize,
  darker,
  lighter,
  paintArt,
  paletteInks,
  type ArtSize,
  type Inks,
  type SpriteArt,
} from "./art.ts";
import type { MachineWork, WorkBeat } from "./frames.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/**
 * Рисунки станков по этапам. Новый этап — новая строка. Буквы — по `ART_LEGEND`: `b`, `B` и `l` —
 * корпус, его тень и блик в цвете этапа.
 */
export const MACHINE_ART: Readonly<Record<Stage, SpriteArt>> = {
  spec: [
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    "klllllllllllllllllllllllllllllllllllllbk",
    "klbkkkkkkkkkkkkkkkkkkkkbbbbbbbbbbbbbbbBk",
    "klbkGGG1GGG1GGG1GGG1GGkbbbbbbbbbbbbbbbBk",
    "klbkGGG1kkkkkkkkGGG1GGkbbbbbbbbbbbbbbbBk",
    "klbkGGG1kppppppkGGG1GGkbbbbbbbbbbbbbbbBk",
    "klbk1111kppppppk111111kbbbbbb5kbbbbbbbBk",
    "klbkGGG1kp22pppkGGG1kGkbbbbbbkhhkbbbbbBk",
    "klbkGGG1kkkkkkkkGGG1kGkbbbbbkhhkbbbbbbBk",
    "klbkGGG1GGG1GGG1GGG1kGkbbbbkhhkbbbbbbbBk",
    "klbk11111111111kkkkkk1kbbbkhhkbbbbbbbbBk",
    "klbkGGG1GGG1GGG1GGG1GGkbbkhhkbbbbbbbbbBk",
    "klbkGGG1GGG1GGG1GGG1GGkbkskkbbbbbbbbbbBk",
    "klbkkkkkkkkkkkkkkkkkkkkbbbbbbbbbbbbbbbBk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBlBBlBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBBBBBBBBBk",
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ],
  code: [
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    "klllllllllllllllllllllllllllllllllllllbk",
    "klbkkkkkkkkkkkkkkkkkkkkkkkkkkbbbbbbbbbBk",
    "klbkggggggggggggggggggggggggkbbbbbbbbbBk",
    "klbkg333333g11111111ggggggggkbbbbbbbbbBk",
    "klbkggggggggggggggggggggggggkbbbbbbbbbBk",
    "klbkggg22222gOOOOOOOOOggggggkbbbbbbbbbBk",
    "klbkggggggggggggggggggggggggkbbbbbbbbbBk",
    "klbkg33333333333g4444ggg**ggkbbbbbbbbbBk",
    "klbkggggggggggggggggggggggggkbbbbbbbbbBk",
    "klbkkkkkkkkkkkkkkkkkkkkkkkkkkbbbbbbbbbBk",
    "klbkkkkkkkkkkkkkkkkkkkkkkkkkkbbbbbbbbbBk",
    "klbkpPpPpPpPpPpPpPpPpPpPpPpPkbbbbbbbbbBk",
    "klbkkkkkkkkkkkkkkkkkkkkkkkkkkbbbbbbbbbBk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBlBBlBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBBBBBBBBBk",
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ],
  test: [
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    "klllllllllllllllllllllllllllllllllllllbk",
    "klbkkkkkkkkkkkkkkbbkkkkkkkkkkkkkkbbbbbBk",
    "klbkggggggggggggkbbbk***kbbk***kbbbbbbBk",
    "klbkgggggggg3gggkbbbkG**kbbkG**kbbbbbbBk",
    "klbkggggggg3ggggkbbbk***kbbk***kbbbbbbBk",
    "klbkgg3ggg3gggggkbbbk***kbbk***kbbbbbbBk",
    "klbkggg3g3ggggggkbbbk***kbbk***kbbbbbbBk",
    "klbkgggg3gggggggkbbbk111kbbk555kbbbbbbBk",
    "klbkiiiiiiiiiiiikbbbk111kbbk555kbbbbbbBk",
    "klbkkkkkkkkkkkkkkbbbk111kbbk555kbbbbbbBk",
    "klbkkkkkkkkkkkkkkbbbk111kbbk555kbbbbbbBk",
    "klbkp3pOp2ppppppkbbbk111kbbk555kbbbbbbBk",
    "klbkkkkkkkkkkkkkkbbbkkkkkbbkkkkkbbbbbbBk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBlBBlBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBBBBBBBBBk",
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ],
  review: [
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    "klllllllllllllllllllllllllllllllllllllbk",
    "klbbbbkkkkkbbbbbbbkkkkkkkkkkkkkbbbbbbbBk",
    "klbbbkkGGGkkbbbbbbkgggggggggggkbbbbbbbBk",
    "klbbk**GGGGkkbbbbbkgggggggggggkbbbbbbbBk",
    "klbk*GGGGGGGkkbbbbkgg33ggOOgggkbbbbbbbBk",
    "klbk*GGGGGGGGkbbbbkgggggggggggkbbbbbbbBk",
    "klbkGGGGGGGGGkbbbbkgggggggggggkbbbbbbbBk",
    "klbkGGGGGGGGGkbbbbkgiiiiiiiiigkbbbbbbbBk",
    "klbkkGGGGGGGkkbbbbkgggggggggggkbbbbbbbBk",
    "klbbkkGGGGGkkbbbbbkkkkkkkkkkkkkbbbbbbbBk",
    "klbbbkkGGGkkkkbbbbkkkkkkkkkkkkkbbbbbbbBk",
    "klbbbbkkkkkbkkkbbbkp4pppppppppkbbbbbbbBk",
    "klbbbbbbbbbbbkkkbbkkkkkkkkkkkkkbbbbbbbBk",
    "kBBBBBBBBBBBBBkkkBBBBBBBBBBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBlBBlBBBBk",
    "kBBBkBBkBBkBBkBBBBBBBBBBBBBBBBBBBBBBBBBk",
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ],
  ship: [
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    "klllllllllllllllllllllllllllllllllllllbk",
    "klbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBk",
    "klbbbbkkkkkkkkkbbbbbkkkkkkkkkbbbbbbbbbBk",
    "klbbbbkyyyyyyykbbbbbkyyyyyyykbbbbbbbbbBk",
    "klbbbbkWwwwwWwkbbbbbkWwwwwWwkbbbbbbbbbBk",
    "klbkkkkwWwwWwwkkkkkkkwWwwWwwkkkkkkkkkbBk",
    "klktitkwwWWwwwktitttkwwWWwwwktttittttkBk",
    "klktitkwwWWwwwktitttkwwWWwwwktttittttkBk",
    "klktitkwWwwWwwktitttkwWwwWwwktttittttkBk",
    "klktitkWwwwwWwktitttkWwwwwWwktttittttkBk",
    "klktitkkkkkkkkktitttkkkkkkkkktttittttkBk",
    "klktitttitttitttitttitttitttitttittttkBk",
    "klbkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkbBk",
    "kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kBhhkkkkhhhhkkkkhhhhkkkkhhhhkkkkhhhhkkBk",
    "kBhhkkkkhhhhkkkkhhhhkkkkhhhhkkkkhhhhkkBk",
    "kBhhkkkkhhhhkkkkhhhhkkkkhhhhkkkkhhhhkkBk",
    ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ],
};

/** Лампа станка, когда он не работает: тусклая. */
export const LAMP_OFF_ART: SpriteArt = [".kkk.", "koook", "koook", "koook", ".kkk."];

/** Лампа работающего станка: светится, она же мигает. */
export const LAMP_ON_ART: SpriteArt = [".kkk.", "kO*Ok", "kOOOk", "kOOOk", ".kkk."];

/** Где лампа на рисунке станка: левый верхний угол, пиксели от угла рисунка. */
export const LAMP_AT = { x: 33, y: 2 } as const;

/** Накладка работы станка: кадры поверх корпуса, которые сменяют друг друга в такт удару. */
export interface MachineWorkArt {
  /** Левый верхний угол накладки, пиксели от угла рисунка станка, как у `LAMP_AT`. */
  readonly at: { readonly x: number; readonly y: number };
  /**
   * Кадры работы: в кадре только пиксели, которые в работе отличаются от корпуса, остальное —
   * точка. Все кадры одного размера.
   */
  readonly frames: Readonly<Record<WorkBeat, SpriteArt>>;
}

/**
 * Накладки работы станков по этапам. Новый этап — новая строка. Постановка — перо ведёт линию
 * по чертежу, код — строки в терминале то растут, то сжимаются, мигает курсор, проверки — пузырьки в колбах,
 * ревью — блик ходит по линзе лупы, выпуск — полосы ленты сдвигаются.
 */
export const MACHINE_WORK_ART: Readonly<Record<Stage, MachineWorkArt>> = {
  spec: {
    at: { x: 9, y: 5 },
    frames: {
      workA: ["......", "11k...", "......"],
      workB: ["......", "1111k.", "......"],
    },
  },
  code: {
    at: { x: 5, y: 4 },
    frames: {
      workA: [
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        "33333*.................",
      ],
      workB: [
        "...........gggg........",
        ".......................",
        "............ggggg......",
        ".......................",
        "...................gg..",
        "3333333333*............",
      ],
    },
  },
  test: {
    at: { x: 21, y: 3 },
    frames: {
      workA: [
        "..........",
        "..........",
        "..........",
        "..........",
        "..........",
        "..........",
        "........*.",
        ".*........",
        ".........*",
        "*.........",
      ],
      workB: [
        "..........",
        "..........",
        "..........",
        "..........",
        "..........",
        ".*.......*",
        "..........",
        ".......*..",
        "..*.......",
        "........*.",
      ],
    },
  },
  review: {
    at: { x: 4, y: 3 },
    frames: {
      workA: [
        ".........",
        ".........",
        ".*.......",
        ".........",
        ".........",
        ".........",
        ".........",
        ".........",
        ".........",
      ],
      workB: [
        ".........",
        ".GG......",
        "G........",
        "G........",
        ".........",
        "......**.",
        ".......*.",
        ".........",
        ".........",
      ],
    },
  },
  ship: {
    at: { x: 3, y: 7 },
    frames: {
      workA: [
        "it..........it..............it....",
        "it..........it..............it....",
        "it..........it..............it....",
        "it..........it..............it....",
        "it..........it..............it....",
        "it..it..it..it..it..it..it..it....",
      ],
      workB: [
        ".ti..........ti..............ti...",
        ".ti..........ti..............ti...",
        ".ti..........ti..............ti...",
        ".ti..........ti..............ti...",
        ".ti..........ti..............ti...",
        ".ti..ti..ti..ti..ti..ti..ti..ti...",
      ],
    },
  },
};

/** Размер самого большого станка: от него считается отступ табличек и границы цеха. */
export const MACHINE_SIZE: ArtSize = Object.values(MACHINE_ART)
  .map(artSize)
  .reduce((largest, size) => ({
    width: Math.max(largest.width, size.width),
    height: Math.max(largest.height, size.height),
  }));

/** Подвижные части станка в кадре: накладки работы и горящая лампа. */
export interface MachineSprites {
  readonly work: Readonly<Record<WorkBeat, Sprite>>;
  readonly lampOn: Sprite;
}

function bodyInks(palette: Palette, color: number): Inks {
  return {
    ...paletteInks(palette),
    body: color,
    bodyShade: darker(color),
    bodyLight: lighter(color),
  };
}

function spriteOf(art: SpriteArt, inks: Inks, x: number, y: number): Sprite {
  const sprite = new Sprite(textureOf(paintArt(art, inks)));
  sprite.position.set(x, y);
  return sprite;
}

/**
 * Рисует станок этапа; координаты — в пикселях рисунка.
 * @param {Stage} stage Этап станка.
 * @param {StationPlan} plan Где станок и его рабочий.
 * @param {Palette} palette Краски цеха.
 * @returns {{ root: Container; sprites: MachineSprites }} Станок и его подвижные части.
 */
export function drawMachine(
  stage: Stage,
  plan: StationPlan,
  palette: Palette,
): { root: Container; sprites: MachineSprites } {
  const art = MACHINE_ART[stage];
  const { width, height } = artSize(art);
  const inks = bodyInks(palette, palette.stations[stage]);
  const left = -Math.floor(width / 2);
  const top = -Math.floor(height / 2);
  const lampX = left + LAMP_AT.x;
  const lampY = top + LAMP_AT.y;
  const lampOn = spriteOf(LAMP_ON_ART, inks, lampX, lampY);
  lampOn.visible = false;
  const { at, frames } = MACHINE_WORK_ART[stage];
  const work = Object.fromEntries(
    Object.entries(frames).map(([beat, frame]) => {
      const sprite = spriteOf(frame, inks, left + at.x, top + at.y);
      sprite.visible = false;
      return [beat, sprite];
    }),
  ) as Record<WorkBeat, Sprite>;
  // Накладки лежат на корпусе и под лампами: лампа остаётся видна поверх любого кадра работы.
  const root = new Container({
    children: [
      spriteOf(art, inks, left, top),
      ...Object.values(work),
      spriteOf(LAMP_OFF_ART, inks, lampX, lampY),
      lampOn,
    ],
  });
  root.position.set(
    Math.round(plan.machine.x * PIXELS_PER_UNIT),
    Math.round(plan.machine.y * PIXELS_PER_UNIT),
  );
  return { root, sprites: { work, lampOn } };
}

/**
 * Показывает кадр работы станка: накладку текущего такта или ни одной, пока станок стоит.
 * @param {MachineSprites} sprites Подвижные части станка.
 * @param {MachineWork} work Кадр работы или покой.
 */
export function showMachineWork(sprites: MachineSprites, work: MachineWork): void {
  for (const [beat, sprite] of Object.entries(sprites.work)) sprite.visible = beat === work;
}
