// Рабочие и деталь: фигуры рисуются один раз и запекаются в текстуры, в кадре у спрайтов
// меняются только координаты, поворот, масштаб и прозрачность.

import type { PartFrame, PartStatus, Stage, WorkerFrame } from "@cyberzavod/core";
import { Container, Graphics, Sprite, type Renderer, type Texture } from "pixi.js";
import { shade, type Palette } from "./palette.ts";
import { poseOf } from "./pose.ts";
import { UNIT } from "./units.ts";

/** Запечённые текстуры действующих лиц. */
export interface ActorTextures {
  readonly shadow: Texture;
  readonly torso: Texture;
  readonly helmet: Texture;
  readonly hand: Texture;
  readonly crate: Texture;
  readonly glow: Texture;
}

/** Рабочий в кадре: корпус поворачивается целиком, руки двигаются по позе. */
export interface WorkerSprites {
  readonly root: Container;
  readonly leftHand: Sprite;
  readonly rightHand: Sprite;
}

/** Деталь в кадре: ящик, свечение состояния под ним и цвета свечения. */
export interface CrateSprites {
  readonly root: Container;
  readonly crate: Sprite;
  readonly glow: Sprite;
  readonly glowColors: Readonly<Record<PartStatus, number | null>>;
}

// Размеры в точках рисования.
const OUTLINE = 6;
const SHADOW = { radiusX: 46, radiusY: 40, alpha: 0.25 } as const;
const TORSO = { depth: 24, width: 40 } as const;
const HELMET_SIZE = { radius: 24, visor: 16, highlight: 7 } as const;
const HAND_RADIUS = 10;
const HAND_SPREAD = 0.3 * UNIT;
const CRATE_SIZE = { half: 22, radius: 6, plank: 4 } as const;
const GLOW_SIZE = { radius: 40, ring: 6, alpha: 0.45 } as const;
// Готовая деталь мягко пульсирует свечением.
const GLOW_PULSE = { periodMs: 1_200, base: 0.75, swing: 0.25 } as const;
const FULL_TURN = Math.PI * 2;
const WHITE = 0xffffff;
const HIGHLIGHT_ALPHA = 0.75;
const VISOR_SHADE = -0.25;

/**
 * Рисует фигуры действующих лиц и запекает их в текстуры.
 * @param {Renderer} renderer Рендерер цеха.
 * @param {Palette} palette Краски цеха.
 * @returns {ActorTextures} Текстуры рабочих и детали.
 */
export function bakeActorTextures(renderer: Renderer, palette: Palette): ActorTextures {
  const bake = (graphics: Graphics) => {
    const texture = renderer.generateTexture({
      target: graphics,
      resolution: renderer.resolution,
      antialias: true,
    });
    graphics.destroy();
    return texture;
  };
  const { half, radius, plank } = CRATE_SIZE;
  const { ink } = palette;
  return {
    shadow: bake(
      new Graphics()
        .ellipse(0, 0, SHADOW.radiusX, SHADOW.radiusY)
        .fill({ color: ink, alpha: SHADOW.alpha }),
    ),
    // Корпус белый: цвет формы по этапу даёт tint спрайта.
    torso: bake(
      new Graphics()
        .ellipse(0, 0, TORSO.depth, TORSO.width)
        .fill(WHITE)
        .stroke({ width: OUTLINE, color: ink }),
    ),
    helmet: bake(
      new Graphics()
        .circle(0, 0, HELMET_SIZE.radius)
        .fill(palette.helmet)
        .stroke({ width: OUTLINE, color: ink })
        .roundRect(HELMET_SIZE.radius - 12, -10, HELMET_SIZE.visor, 20, 6)
        .fill(shade(palette.helmet, VISOR_SHADE))
        .stroke({ width: 4, color: ink })
        .circle(-6, -8, HELMET_SIZE.highlight)
        .fill({ color: WHITE, alpha: HIGHLIGHT_ALPHA }),
    ),
    hand: bake(
      new Graphics().circle(0, 0, HAND_RADIUS).fill(palette.skin).stroke({ width: 5, color: ink }),
    ),
    crate: bake(
      new Graphics()
        .roundRect(-half, -half, half * 2, half * 2, radius)
        .fill(palette.crate.wood)
        .stroke({ width: OUTLINE, color: ink })
        .moveTo(-half + 5, -half + 5)
        .lineTo(half - 5, half - 5)
        .moveTo(half - 5, -half + 5)
        .lineTo(-half + 5, half - 5)
        .stroke({ width: plank, color: palette.crate.plank }),
    ),
    // Кольцо белое: цвет состояния даёт tint спрайта.
    glow: bake(
      new Graphics()
        .circle(0, 0, GLOW_SIZE.radius)
        .fill({ color: WHITE, alpha: GLOW_SIZE.alpha })
        .stroke({ width: GLOW_SIZE.ring, color: WHITE }),
    ),
  };
}

function centered(texture: Texture): Sprite {
  return new Sprite({ texture, anchor: 0.5 });
}

/**
 * Собирает спрайты рабочего этапа.
 * @param {Stage} stage Этап — цвет формы.
 * @param {ActorTextures} textures Запечённые текстуры.
 * @param {Palette} palette Краски цеха.
 * @returns {WorkerSprites} Рабочий, ещё не поставленный на место.
 */
export function createWorker(
  stage: Stage,
  textures: ActorTextures,
  palette: Palette,
): WorkerSprites {
  const leftHand = centered(textures.hand);
  const rightHand = centered(textures.hand);
  const torso = centered(textures.torso);
  torso.tint = palette.stations[stage];
  // Руки под корпусом: видны, только когда вынесены вперёд.
  const root = new Container({
    children: [centered(textures.shadow), leftHand, rightHand, torso, centered(textures.helmet)],
  });
  return { root, leftHand, rightHand };
}

/**
 * Ставит рабочего в кадр: место, поворот и поза.
 * @param {WorkerSprites} sprites Спрайты рабочего.
 * @param {WorkerFrame} worker Рабочий в кадре.
 */
export function placeWorker(sprites: WorkerSprites, worker: WorkerFrame): void {
  const pose = poseOf(worker);
  sprites.root.position.set(worker.position.x * UNIT, worker.position.y * UNIT);
  sprites.root.rotation = worker.heading;
  sprites.root.scale.set(1 + pose.bob);
  sprites.leftHand.position.set((pose.reach + pose.swing) * UNIT, -HAND_SPREAD);
  sprites.rightHand.position.set((pose.reach - pose.swing) * UNIT, HAND_SPREAD);
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
 * Ставит деталь в кадр: место, поворот по несущему и свечение состояния.
 * @param {CrateSprites} sprites Спрайты детали.
 * @param {PartFrame} part Деталь в кадре.
 * @param {number} heading Куда смотрит несущий её рабочий, если деталь в руках.
 * @param {number} time Момент сцены, мс, — для пульса свечения.
 */
export function placeCrate(
  sprites: CrateSprites,
  part: PartFrame,
  heading: number,
  time: number,
): void {
  sprites.root.position.set(part.position.x * UNIT, part.position.y * UNIT);
  sprites.crate.rotation = part.carried ? heading : 0;
  const glow = sprites.glowColors[part.status];
  sprites.glow.visible = glow !== null;
  if (glow === null) return;
  sprites.glow.tint = glow;
  sprites.glow.alpha =
    GLOW_PULSE.base + GLOW_PULSE.swing * Math.sin((time / GLOW_PULSE.periodMs) * FULL_TURN);
}
