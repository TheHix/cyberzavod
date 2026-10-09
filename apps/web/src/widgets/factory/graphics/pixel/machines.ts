// Machines: each stage has its own 40×20 sprite, a casing in the stage color with a dark front
// face and decor on the lid (blueprint, terminal, test tubes, magnifier, conveyor). Moving parts
// are separate sprites: work overlays (one shown while the worker strikes at the machine), the
// unlit lamp always in place, the lit one appears while the machine holds the part. Nothing else
// changes in a frame.

import type { Stage } from "@cyberzavod/core";
import type { Point, StationPlan } from "@cyberzavod/player";
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
 * Machine sprites by stage. A new stage is a new row. Letters follow `ART_LEGEND`: `b`, `B` and `l`
 * are the casing, its shade and highlight in the stage color.
 */
export const MACHINE_ART: Readonly<Record<Stage, SpriteArt>> = {
  planning: [
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
  implementation: [
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
  verification: [
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
  record: [
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

/** Machine lamp when it is not working: dim. */
export const LAMP_OFF_ART: SpriteArt = [".kkk.", "koook", "koook", "koook", ".kkk."];

/** Lamp of a working machine: lit, and it blinks. */
export const LAMP_ON_ART: SpriteArt = [".kkk.", "kO*Ok", "kOOOk", "kOOOk", ".kkk."];

/** Where the lamp is on the machine sprite: top left corner, pixels from the sprite corner. */
export const LAMP_AT = { x: 33, y: 2 } as const;

/** Machine work overlay: frames over the casing that alternate in time with the strike. */
export interface MachineWorkArt {
  /** Top left corner of the overlay, pixels from the machine sprite corner, as in `LAMP_AT`. */
  readonly at: { readonly x: number; readonly y: number };
  /**
   * Work frames: a frame has only the pixels that differ from the casing during work, the rest is a
   * dot. All frames are the same size.
   */
  readonly frames: Readonly<Record<WorkBeat, SpriteArt>>;
}

/**
 * Machine work overlays by stage. A new stage is a new row. Plan: a pen draws a line on the
 * blueprint; code: lines in the terminal grow and shrink, the cursor blinks; checks: bubbles in the
 * flasks; review: a glint moves across the magnifier lens; record: the belt stripes shift.
 */
export const MACHINE_WORK_ART: Readonly<Record<Stage, MachineWorkArt>> = {
  planning: {
    at: { x: 9, y: 5 },
    frames: {
      workA: ["......", "11k...", "......"],
      workB: ["......", "1111k.", "......"],
    },
  },
  implementation: {
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
  verification: {
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
  record: {
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

const MACHINE_SIZES = Object.values(MACHINE_ART).map(artSize);

/** Size of the largest machine: plaque offset and factory bounds are computed from it. */
export const MACHINE_SIZE: ArtSize = MACHINE_SIZES.reduce((largest, size) => ({
  width: Math.max(largest.width, size.width),
  height: Math.max(largest.height, size.height),
}));

/** Moving parts of a machine in a frame: work overlays and the lit lamp. */
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

function workSpritesOf(stage: Stage, inks: Inks, machineCorner: Point): Record<WorkBeat, Sprite> {
  const { at, frames } = MACHINE_WORK_ART[stage];
  const entries = Object.entries(frames).map(([beat, frame]) => {
    const sprite = spriteOf(frame, inks, machineCorner.x + at.x, machineCorner.y + at.y);

    sprite.visible = false;

    return [beat, sprite];
  });

  return Object.fromEntries(entries) as Record<WorkBeat, Sprite>;
}

/**
 * Draws a stage machine; coordinates are in sprite pixels.
 * @param {Stage} stage Machine stage.
 * @param {StationPlan} plan Where the machine and its worker are.
 * @param {Palette} palette Factory inks.
 * @returns {{ root: Container; sprites: MachineSprites }} The machine and its moving parts.
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
  const work = workSpritesOf(stage, inks, { x: left, y: top });
  // Overlays lie on the casing and under the lamps: the lamp stays visible over any work frame.
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
 * Shows a machine work frame: the overlay of the current beat, or none while the machine stands.
 * @param {MachineSprites} sprites Moving parts of the machine.
 * @param {MachineWork} work Work frame or rest.
 */
export function showMachineWork(sprites: MachineSprites, work: MachineWork): void {
  for (const [beat, sprite] of Object.entries(sprites.work)) sprite.visible = beat === work;
}
