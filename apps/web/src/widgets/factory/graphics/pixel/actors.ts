// Рабочие, мастер и деталь: рисунки запекаются в текстуры один раз при встраивании, в кадре
// у готовых спрайтов меняются только текстура кадра, место, зеркало, видимость, `tint`
// и порядок по `y`. Новые объекты в кадре не создаются.

import { STAGES, type Stage } from "@cyberzavod/core";
import {
  type ForemanFrame,
  type PartFrame,
  type PartStatus,
  type Point,
  type Scene,
  type WorkerFrame,
} from "@cyberzavod/player";
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
import { ACTOR_ART } from "./actor-art.ts";
import {
  facingOf,
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

/**
 * Стоит ли человек на месте в этой позе. У таких поз видимая фигура считается для табличек:
 * на постах человек стоит, бьёт, тянется и жестикулирует, а шагает и несёт деталь мимо них.
 * Новая поза — новая строка: компилятор не даст её пропустить.
 */
const ACTOR_POSE_IN_PLACE: Readonly<Record<ActorPose, boolean>> = {
  stand: true,
  walkA: false,
  walkB: false,
  carryA: false,
  carryB: false,
  reach: true,
  workA: true,
  workB: true,
  talkA: true,
  talkB: true,
};

function inkedCellsOf(art: SpriteArt): { column: number; row: number }[] {
  const cells = art.flatMap((line, row) =>
    [...line].map((letter, column) => ({ column, row, letter })),
  );

  return cells.filter(({ letter }) => ART_LEGEND[letter] !== null);
}

// Видимая фигура человека на месте по всем сторонам и позам, в том числе с поднятыми руками.
// Бок рисуется вправо, а влево зеркалится, поэтому по горизонтали берётся больший из двух краёв.
// Шаг (на пиксель ниже), деталь в руках и тень не считаются: тень — затемнение пола.
function figureBoxOf(arts: readonly SpriteArt[]): FigureBox {
  const sizes = arts.map(artSize);
  const centerX = (sizes[0]?.width ?? 0) / 2;
  const centerY = (sizes[0]?.height ?? 0) / 2;
  const cells = arts.flatMap(inkedCellsOf);
  const columns = cells.map(({ column }) => column);
  const rows = cells.map(({ row }) => row);
  const left = Math.min(...columns);
  const right = Math.max(...columns) + 1;
  const top = Math.min(...rows);
  const bottom = Math.max(...rows) + 1;

  const halfWidth = Math.max(centerX - left, right - centerX);

  return { left: -halfWidth, top: top - centerY, right: halfWidth, bottom: bottom - centerY };
}

const IN_PLACE_ARTS: SpriteArt[] = Object.values(ACTOR_ART).flatMap((poses) => {
  const inPlace = Object.entries(poses).filter(([pose]) => ACTOR_POSE_IN_PLACE[pose as ActorPose]);

  return inPlace.map(([, art]) => art);
});

/** Где человек занимает место вокруг своей точки плана: по ней таблички обходят фигуру. */
export const ACTOR_FIGURE: FigureBox = figureBoxOf(IN_PLACE_ARTS);

/**
 * Лежит ли деталь в руках над несущим, когда он смотрит в эту сторону. Вниз ящик перед грудью
 * и закрывает руки, но не лицо; вверх и вбок руки рисуются поверх ящика. Новая сторона —
 * новая строка: компилятор не даст её пропустить.
 */
const CARRIED_IN_FRONT: Readonly<Record<Facing, boolean>> = {
  down: true,
  up: false,
  side: false,
};

// Слой людей — целый пиксель `y`, поэтому полпикселя ставят деталь вплотную к несущему,
// но не между ним и соседом по соседнему ряду пикселей.
const CARRIED_LAYER_STEP = 0.5;

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
  const bakeFacing = (poses: Readonly<Record<ActorPose, SpriteArt>>) => {
    const textures = Object.entries(poses).map(([pose, art]) => [pose, bake(art)]);

    return Object.fromEntries(textures) as Record<ActorPose, Texture>;
  };
  const facings = Object.entries(ACTOR_ART).map(([facing, poses]) => [facing, bakeFacing(poses)]);

  return Object.fromEntries(facings) as PoseTextures;
}

/**
 * Запекает рисунки действующих лиц в текстуры: каждому этапу своя форма, мастеру — свой цвет
 * и каска.
 * @param {Palette} palette Краски цеха.
 * @returns {ActorTextures} Текстуры рабочих, мастера и детали.
 */
export function bakeActorTextures(palette: Palette): ActorTextures {
  const inks = paletteInks(palette);
  const workerEntries = STAGES.map((stage) => {
    const workerInks = uniformInks(palette, palette.stations[stage]);

    return [stage, bakePoses(workerInks)];
  });
  const workers = Object.fromEntries(workerEntries) as Record<Stage, PoseTextures>;

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

// Слой по целому пикселю `y`: так сортируются люди, и деталь встаёт относительно них.
function layerOf(position: Point): number {
  return Math.round(position.y * PIXELS_PER_UNIT);
}

function placeActor(sprites: ActorSprites, position: Point, frame: ActorFrame): void {
  const layer = layerOf(position);

  sprites.root.position.set(Math.round(position.x * PIXELS_PER_UNIT), layer);
  sprites.root.zIndex = layer;
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
 * Слой детали для порядка рисования. На станке и без несущего деталь сортируется по своему `y`,
 * как всё в цехе; в руках она встаёт вплотную к несущему: над ним, если он смотрит вниз,
 * иначе под ним, чтобы его руки были поверх ящика.
 * @param {PartFrame} part Деталь в кадре.
 * @param {WorkerFrame | undefined} holder Рабочий, у которого деталь, если он есть в кадре.
 * @returns {number} Слой: чем больше, тем ближе к зрителю.
 */
export function crateLayerOf(part: PartFrame, holder: WorkerFrame | undefined): number {
  if (!part.carried || holder === undefined) return layerOf(part.position);

  const front = CARRIED_IN_FRONT[facingOf(holder.heading).facing];

  return layerOf(holder.position) + (front ? CARRIED_LAYER_STEP : -CARRIED_LAYER_STEP);
}

/**
 * Ставит деталь в кадр: место, слой относительно несущего и свечение состояния, которое мигает
 * своим цветом.
 * @param {CrateSprites} sprites Спрайты детали.
 * @param {Scene} scene Кадр цеха: деталь, её несущий и момент сцены для мигания.
 */
export function placeCrate(sprites: CrateSprites, scene: Scene): void {
  const { part } = scene;
  const holder = scene.workers.find((worker) => worker.station === part.holder);

  sprites.root.position.set(
    Math.round(part.position.x * PIXELS_PER_UNIT),
    Math.round(part.position.y * PIXELS_PER_UNIT),
  );
  sprites.root.zIndex = crateLayerOf(part, holder);
  const glow = sprites.glowColors[part.status];

  sprites.glow.visible = glow !== null && glowLit(scene.time);
  if (glow !== null) sprites.glow.tint = glow;
}
