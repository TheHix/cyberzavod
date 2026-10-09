// Workers, the foreman and the part: sprites are baked into textures once on embedding; in a
// frame, the ready sprites change only the frame texture, position, mirroring, visibility, `tint`
// and order by `y`. No new objects are created in a frame.

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

/** The part in hands and on the machine: a 10×10 crate. */
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

/** Glow under the part: a ring, white, since `tint` gives the state color. */
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

/** Shadow under the feet: a black oval, the sprite gives it transparency. */
export const SHADOW_ART: SpriteArt = ["..kkkkkkkk..", ".kkkkkkkkkk."];

// The center of a 16×16 human sprite is its plan point; the shadow starts five pixels below the
// center, under the feet: below the last row of the feet.
const SHADOW_TOP = 5;
const SHADOW_ALPHA = 0.28;

/**
 * Rectangle around the human's center, in pixels: from the center to the edges of the visible
 * figure.
 */
export interface FigureBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Whether the human stands in place in this pose. For such poses the visible figure counts for
 * plaques: at posts a human stands, strikes, reaches and gestures, but walks and carries the part
 * past them. A new pose is a new row: the compiler will not let it be skipped.
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

// The visible figure of a human in place across all sides and poses, including raised arms. The
// side view is drawn facing right and mirrored for left, so horizontally the larger of the two
// edges is taken. A step (one pixel lower), the part in hands and the shadow do not count: the
// shadow is a darkening of the floor.
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

/** Where a human takes up space around their plan point: plaques avoid the figure by it. */
export const ACTOR_FIGURE: FigureBox = figureBoxOf(IN_PLACE_ARTS);

/**
 * Whether the part in hands lies above the carrier when they face this side. Facing down, the
 * crate is in front of the chest and covers the arms but not the face; facing up and sideways,
 * the arms are drawn over the crate. A new side is a new row: the compiler will not let it be
 * skipped.
 */
const CARRIED_IN_FRONT: Readonly<Record<Facing, boolean>> = {
  down: true,
  up: false,
  side: false,
};

// The human layer is a whole pixel of `y`, so half a pixel places the part right next to the
// carrier, but not between them and a neighbor on the adjacent pixel row.
const CARRIED_LAYER_STEP = 0.5;

type PoseTextures = Readonly<Record<Facing, Readonly<Record<ActorPose, Texture>>>>;

/** Baked textures of the actors. */
export interface ActorTextures {
  readonly workers: Readonly<Record<Stage, PoseTextures>>;
  readonly foreman: PoseTextures;
  readonly shadow: Texture;
  readonly crate: Texture;
  readonly glow: Texture;
}

/**
 * A worker or the foreman in a frame: a shadow on the floor and a body whose texture the frame
 * picks.
 */
export interface ActorSprites {
  readonly root: Container;
  readonly body: Sprite;
  readonly textures: PoseTextures;
}

/** The part in a frame: the crate, the state glow under it, and the glow colors. */
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

// The foreman has a uniform of their own color and a white helmet: they stand out among workers in
// yellow helmets.
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
 * Bakes actor sprites into textures: each stage gets its own uniform, the foreman gets their own
 * color and helmet.
 * @param {Palette} palette Factory inks.
 * @returns {ActorTextures} Textures of the workers, the foreman and the part.
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
 * Frees all baked actor textures together with their canvases: both those on sprites now and the
 * frames not on sprites. Destroying the sprites does not affect the latter.
 * @param {ActorTextures} textures Textures from `bakeActorTextures`.
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

// The anchor is a whole pixel at the sprite center, not a fraction of `anchor`: the position stays
// on the pixel grid.
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

// Layer by whole pixel of `y`: humans are sorted this way, and the part is placed relative to them.
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
 * Assembles the sprites of a stage worker.
 * @param {Stage} stage Stage, the uniform color.
 * @param {ActorTextures} textures Baked textures.
 * @returns {ActorSprites} A worker not yet put in place.
 */
export function createWorker(stage: Stage, textures: ActorTextures): ActorSprites {
  return createActor(textures.workers[stage], textures.shadow);
}

/**
 * Puts a worker into the frame: position, side, mirroring and pose.
 * @param {ActorSprites} sprites Worker sprites.
 * @param {WorkerFrame} worker Worker in the frame.
 */
export function placeWorker(sprites: ActorSprites, worker: WorkerFrame): void {
  placeActor(sprites, worker.position, workerFrameOf(worker));
}

/**
 * Assembles the foreman's sprites: the same human, but in a uniform of their own color and a white
 * helmet.
 * @param {ActorTextures} textures Baked textures.
 * @returns {ActorSprites} The foreman, not yet put in place.
 */
export function createForeman(textures: ActorTextures): ActorSprites {
  return createActor(textures.foreman, textures.shadow);
}

/**
 * Puts the foreman into the frame: position, side, mirroring and pose.
 * @param {ActorSprites} sprites Foreman sprites.
 * @param {ForemanFrame} foreman Foreman in the frame.
 */
export function placeForeman(sprites: ActorSprites, foreman: ForemanFrame): void {
  placeActor(sprites, foreman.position, foremanFrameOf(foreman));
}

/**
 * Assembles the part sprites.
 * @param {ActorTextures} textures Baked textures.
 * @param {Palette} palette Factory inks: glow colors by part state.
 * @returns {CrateSprites} The part, not yet put in place.
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
 * Part layer for draw order. On the machine and without a carrier, the part is sorted by its own
 * `y`, like everything on the floor; in hands it sits right next to the carrier: above them if they
 * face down, otherwise below them, so their arms are over the crate.
 * @param {PartFrame} part Part in the frame.
 * @param {WorkerFrame | undefined} holder The worker holding the part, if they are in the frame.
 * @returns {number} Layer: the larger, the closer to the viewer.
 */
export function crateLayerOf(part: PartFrame, holder: WorkerFrame | undefined): number {
  if (!part.carried || holder === undefined) return layerOf(part.position);

  const front = CARRIED_IN_FRONT[facingOf(holder.heading).facing];

  return layerOf(holder.position) + (front ? CARRIED_LAYER_STEP : -CARRIED_LAYER_STEP);
}

/**
 * Puts the part into the frame: position, layer relative to the carrier, and the state glow that
 * blinks in its color.
 * @param {CrateSprites} sprites Part sprites.
 * @param {Scene} scene Floor frame: the part, its carrier and the scene moment for blinking.
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
