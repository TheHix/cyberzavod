// Рабочие, мастер и деталь: рисунки запекаются в текстуры один раз при встраивании, в кадре
// у готовых спрайтов меняются только текстура кадра, место, зеркало, видимость, `tint`
// и порядок по `y`. Новые объекты в кадре не создаются.

import {
  STAGES,
  type ForemanFrame,
  type PartFrame,
  type PartStatus,
  type Stage,
  type WorkerFrame,
} from "@cyberzavod/core";
import { Container, Sprite, type Texture } from "pixi.js";
import {
  ART_LEGEND,
  artSize,
  darker,
  helmetInks,
  lighter,
  paintArt,
  paletteInks,
  type Inks,
  type SpriteArt,
} from "./art.ts";
import {
  foremanFrameOf,
  glowLit,
  workerFrameOf,
  type ActorFrame,
  type ActorPose,
  type Facing,
} from "./frames.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/**
 * Рисунки человека 16×16 по сторонам и позам: каска, форма, кожа, контур. Буквы — по `ART_LEGEND`:
 * `u`, `U`, `v` — форма, её тень и блик; `h`, `H`, `j` — каска, её тень и блик.
 */
export const ACTOR_ART: Readonly<Record<Facing, Readonly<Record<ActorPose, SpriteArt>>>> = {
  down: {
    stand: [
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kssssssssk...",
      "...kssksskssk...",
      "...kssssssssk...",
      "....kssssssk....",
      "...kkuvvvvukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kUk..kUk....",
      "....kkk..kkk....",
      "................",
      "................",
    ],
    walkA: [
      "................",
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kssssssssk...",
      "...kssksskssk...",
      "...kssssssssk...",
      "....kssssssk....",
      "...kkuvvvvukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kUk..kkk....",
      "....kkk.........",
      "................",
    ],
    walkB: [
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kssssssssk...",
      "...kssksskssk...",
      "...kssssssssk...",
      "....kssssssk....",
      "...kkuvvvvukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kkk..kUk....",
      ".........kkk....",
      "................",
      "................",
    ],
  },
  up: {
    stand: [
      ".....kkkkkk.....",
      "....kjhhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kHHHHHHHHk...",
      "...kHHHHHHHHk...",
      "....kHHHHHHk....",
      ".....kssssk.....",
      "...kkuuuuuukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kUk..kUk....",
      "....kkk..kkk....",
      "................",
      "................",
    ],
    walkA: [
      "................",
      ".....kkkkkk.....",
      "....kjhhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kHHHHHHHHk...",
      "...kHHHHHHHHk...",
      "....kHHHHHHk....",
      ".....kssssk.....",
      "...kkuuuuuukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kUk..kkk....",
      "....kkk.........",
      "................",
    ],
    walkB: [
      ".....kkkkkk.....",
      "....kjhhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHk...",
      "..kHHHHHHHHHHk..",
      "...kHHHHHHHHk...",
      "...kHHHHHHHHk...",
      "....kHHHHHHk....",
      ".....kssssk.....",
      "...kkuuuuuukk...",
      "..kUkuuuuuukUk..",
      "..kskuuUUuuksk..",
      "....kkk..kUk....",
      ".........kkk....",
      "................",
      "................",
    ],
  },
  side: {
    stand: [
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHHk..",
      "...kHHHHHHHHHHkk",
      "...kHHssssssk...",
      "...kHHssskssk...",
      "...kHHssssssk...",
      "....kHsssssk....",
      "....kuvvvvuk....",
      "....kuuuUUuk....",
      "....kuuuuuUsk...",
      ".....kUUUUk.....",
      ".....kkkkkk.....",
      "................",
      "................",
    ],
    walkA: [
      "................",
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHHk..",
      "...kHHHHHHHHHHkk",
      "...kHHssssssk...",
      "...kHHssskssk...",
      "...kHHssssssk...",
      "....kHsssssk....",
      "....kuvvvvuk....",
      "....kuuuUUuk....",
      "....kuuuuuUsk...",
      "...kUk....kUk...",
      "...kkk.....kkk..",
      "................",
    ],
    walkB: [
      ".....kkkkkk.....",
      "....kjjhhhhk....",
      "...kjhhhhhhHk...",
      "...khhhhhhhHHk..",
      "...kHHHHHHHHHHkk",
      "...kHHssssssk...",
      "...kHHssskssk...",
      "...kHHssssssk...",
      "....kHsssssk....",
      "....kuvvvvuk....",
      "....kuuuUUuk....",
      "....kuuuuuUsk...",
      "....kUk..kUk....",
      "....kkk..kkk....",
      "................",
      "................",
    ],
  },
};

/** Деталь в руках и на станке: ящик 10×10. */
export const CRATE_ART: SpriteArt = [
  ".kkkkkkkk.",
  "kyyyyyyyyk",
  "kwWwwwwWwk",
  "kwwWwwWwwk",
  "kwwwWWwwwk",
  "kwwwWWwwwk",
  "kwwWwwWwwk",
  "kwWwwwwWwk",
  "kWWWWWWWWk",
  ".kkkkkkkk.",
];

/** Свечение под деталью: кольцо, белое — цвет состояния даёт `tint`. */
export const GLOW_ART: SpriteArt = [
  "......******......",
  "....**********....",
  "...****....****...",
  "..***........***..",
  ".***..........***.",
  ".**............**.",
  "***............***",
  "**..............**",
  "**..............**",
  "**..............**",
  "**..............**",
  "***............***",
  ".**............**.",
  ".***..........***.",
  "..***........***..",
  "...****....****...",
  "....**********....",
  "......******......",
];

/** Тень под ногами: чёрный овал, прозрачность ему даёт спрайт. */
export const SHADOW_ART: SpriteArt = ["..kkkkkkkk..", ".kkkkkkkkkk."];

// Центр рисунка человека 16×16 — его точка плана; тень начинается на пять пикселей ниже центра,
// под ногами: ниже последнего ряда ступней.
const SHADOW_TOP = 5;
const SHADOW_ALPHA = 0.28;

/** Прямоугольник вокруг центра человека, пиксели: от центра до краёв видимой фигуры. */
export interface FigureBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

// Видимая фигура стоящего человека по всем сторонам. Бок рисуется вправо, а влево зеркалится,
// поэтому по горизонтали берётся больший из двух краёв. Шаг (`walkA` на пиксель ниже) и тень
// не считаются: на постах человек стоит, а тень — затемнение пола.
function figureBoxOf(arts: readonly SpriteArt[]): FigureBox {
  const sizes = arts.map(artSize);
  const centerX = (sizes[0]?.width ?? 0) / 2;
  const centerY = (sizes[0]?.height ?? 0) / 2;
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const art of arts) {
    for (const [row, line] of art.entries()) {
      for (const [column, letter] of [...line].entries()) {
        if (ART_LEGEND[letter] === null) continue;
        left = Math.min(left, column);
        right = Math.max(right, column + 1);
        top = Math.min(top, row);
        bottom = Math.max(bottom, row + 1);
      }
    }
  }
  const halfWidth = Math.max(centerX - left, right - centerX);
  return { left: -halfWidth, top: top - centerY, right: halfWidth, bottom: bottom - centerY };
}

/** Где человек занимает место вокруг своей точки плана: по ней таблички обходят фигуру. */
export const ACTOR_FIGURE: FigureBox = figureBoxOf([
  ACTOR_ART.down.stand,
  ACTOR_ART.up.stand,
  ACTOR_ART.side.stand,
]);
// Деталь в руках рисуется поверх всех: она всегда впереди несущего, куда бы он ни смотрел.
const CARRIED_LAYER = 100_000;

type PoseTextures = Readonly<Record<Facing, Readonly<Record<ActorPose, Texture>>>>;

/** Запечённые текстуры действующих лиц. */
export interface ActorTextures {
  readonly workers: Readonly<Record<Stage, PoseTextures>>;
  readonly foreman: PoseTextures;
  readonly shadow: Texture;
  readonly crate: Texture;
  readonly glow: Texture;
}

/** Рабочий или мастер в кадре: тень на полу и тело, чью текстуру выбирает кадр. */
export interface ActorSprites {
  readonly root: Container;
  readonly body: Sprite;
  readonly textures: PoseTextures;
}

/** Деталь в кадре: ящик, свечение состояния под ним и цвета свечения. */
export interface CrateSprites {
  readonly root: Container;
  readonly crate: Sprite;
  readonly glow: Sprite;
  readonly glowColors: Readonly<Record<PartStatus, number | null>>;
}

function uniformInks(palette: Palette, color: number): Inks {
  return {
    ...paletteInks(palette),
    uniform: color,
    uniformShade: darker(color),
    uniformLight: lighter(color),
  };
}

// Мастер — форма своего цвета и белая каска: его видно среди рабочих в жёлтых касках.
function foremanInks(palette: Palette): Inks {
  return { ...uniformInks(palette, palette.foreman), ...helmetInks(palette.foremanHelmet) };
}

function bakePoses(inks: Inks): PoseTextures {
  const bake = (art: SpriteArt) => textureOf(paintArt(art, inks));
  const facing = (poses: Readonly<Record<ActorPose, SpriteArt>>) => ({
    stand: bake(poses.stand),
    walkA: bake(poses.walkA),
    walkB: bake(poses.walkB),
  });
  return { down: facing(ACTOR_ART.down), up: facing(ACTOR_ART.up), side: facing(ACTOR_ART.side) };
}

/**
 * Запекает рисунки действующих лиц в текстуры: каждому этапу своя форма, мастеру — свой цвет
 * и каска.
 * @param {Palette} palette Краски цеха.
 * @returns {ActorTextures} Текстуры рабочих, мастера и детали.
 */
export function bakeActorTextures(palette: Palette): ActorTextures {
  const inks = paletteInks(palette);
  const workers = Object.fromEntries(
    STAGES.map((stage) => [stage, bakePoses(uniformInks(palette, palette.stations[stage]))]),
  ) as Record<Stage, PoseTextures>;
  return {
    workers,
    foreman: bakePoses(foremanInks(palette)),
    shadow: textureOf(paintArt(SHADOW_ART, inks)),
    crate: textureOf(paintArt(CRATE_ART, inks)),
    glow: textureOf(paintArt(GLOW_ART, inks)),
  };
}

function poseTextureList(poses: PoseTextures): Texture[] {
  return Object.values(poses).flatMap((byPose) => Object.values(byPose));
}

/**
 * Освобождает все запечённые текстуры действующих лиц вместе с их холстами: и те, что сейчас
 * на спрайтах, и кадры, которых на спрайтах нет. Уничтожение спрайтов вторых не затрагивает.
 * @param {ActorTextures} textures Текстуры из `bakeActorTextures`.
 */
export function destroyActorTextures(textures: ActorTextures): void {
  const all = [
    ...Object.values(textures.workers).flatMap(poseTextureList),
    ...poseTextureList(textures.foreman),
    textures.shadow,
    textures.crate,
    textures.glow,
  ];
  for (const texture of all) texture.destroy(true);
}

// Опора — целый пиксель в центре рисунка, а не доля `anchor`: место остаётся на сетке пикселей.
function centered(texture: Texture): Sprite {
  const sprite = new Sprite(texture);
  sprite.pivot.set(texture.width / 2, texture.height / 2);
  return sprite;
}

function createActor(textures: PoseTextures, shadow: Texture): ActorSprites {
  const shadowSprite = new Sprite(shadow);
  shadowSprite.pivot.set(shadow.width / 2, 0);
  shadowSprite.position.set(0, SHADOW_TOP);
  shadowSprite.alpha = SHADOW_ALPHA;
  const body = centered(textures.down.stand);
  return { root: new Container({ children: [shadowSprite, body] }), body, textures };
}

function placeActor(
  sprites: ActorSprites,
  position: { x: number; y: number },
  frame: ActorFrame,
): void {
  const x = Math.round(position.x * PIXELS_PER_UNIT);
  const y = Math.round(position.y * PIXELS_PER_UNIT);
  sprites.root.position.set(x, y);
  sprites.root.zIndex = y;
  sprites.body.texture = sprites.textures[frame.facing][frame.pose];
  sprites.body.scale.x = frame.mirrored ? -1 : 1;
}

/**
 * Собирает спрайты рабочего этапа.
 * @param {Stage} stage Этап — цвет формы.
 * @param {ActorTextures} textures Запечённые текстуры.
 * @returns {ActorSprites} Рабочий, ещё не поставленный на место.
 */
export function createWorker(stage: Stage, textures: ActorTextures): ActorSprites {
  return createActor(textures.workers[stage], textures.shadow);
}

/**
 * Ставит рабочего в кадр: место, сторона, зеркало и поза.
 * @param {ActorSprites} sprites Спрайты рабочего.
 * @param {WorkerFrame} worker Рабочий в кадре.
 */
export function placeWorker(sprites: ActorSprites, worker: WorkerFrame): void {
  placeActor(sprites, worker.position, workerFrameOf(worker));
}

/**
 * Собирает спрайты мастера: тот же человек, но формы своего цвета и в белой каске.
 * @param {ActorTextures} textures Запечённые текстуры.
 * @returns {ActorSprites} Мастер, ещё не поставленный на место.
 */
export function createForeman(textures: ActorTextures): ActorSprites {
  return createActor(textures.foreman, textures.shadow);
}

/**
 * Ставит мастера в кадр: место, сторона, зеркало и поза.
 * @param {ActorSprites} sprites Спрайты мастера.
 * @param {ForemanFrame} foreman Мастер в кадре.
 */
export function placeForeman(sprites: ActorSprites, foreman: ForemanFrame): void {
  placeActor(sprites, foreman.position, foremanFrameOf(foreman));
}

/**
 * Собирает спрайты детали.
 * @param {ActorTextures} textures Запечённые текстуры.
 * @param {Palette} palette Краски цеха — цвета свечения по состоянию детали.
 * @returns {CrateSprites} Деталь, ещё не поставленная на место.
 */
export function createCrate(textures: ActorTextures, palette: Palette): CrateSprites {
  const glow = centered(textures.glow);
  const crate = centered(textures.crate);
  return {
    root: new Container({ children: [glow, crate] }),
    crate,
    glow,
    glowColors: palette.status,
  };
}

/**
 * Ставит деталь в кадр: место и свечение состояния, которое мигает своим цветом.
 * @param {CrateSprites} sprites Спрайты детали.
 * @param {PartFrame} part Деталь в кадре.
 * @param {number} time Момент сцены, мс, — для мигания свечения.
 */
export function placeCrate(sprites: CrateSprites, part: PartFrame, time: number): void {
  const x = Math.round(part.position.x * PIXELS_PER_UNIT);
  const y = Math.round(part.position.y * PIXELS_PER_UNIT);
  sprites.root.position.set(x, y);
  sprites.root.zIndex = part.carried ? CARRIED_LAYER + y : y;
  const glow = sprites.glowColors[part.status];
  sprites.glow.visible = glow !== null && glowLit(time);
  if (glow !== null) sprites.glow.tint = glow;
}
