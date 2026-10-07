import { STAGES } from "@cyberzavod/core";
import { type PartFrame, type WorkerFrame } from "@cyberzavod/player";
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { ACTOR_ART } from "./actor-art.ts";
import { crateLayerOf, destroyActorTextures, type ActorTextures } from "./actors.ts";
import type { ActorPose, Facing } from "./frames.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

type FacingTextures = ActorTextures["foreman"];

// Текстуры той же формы, что у `bakeActorTextures`, но без DOM-холста; холсты видны тесту.
// Позы берутся по ключам `ACTOR_ART`: новая поза попадает сюда сама.
function bakedTextures(): { textures: ActorTextures; sources: TextureSource[] } {
  const sources: TextureSource[] = [];
  const texture = () => {
    const source = new TextureSource();

    sources.push(source);

    return new Texture({ source });
  };
  const poses = (facing: Facing) =>
    Object.fromEntries(Object.keys(ACTOR_ART[facing]).map((pose) => [pose, texture()])) as Record<
      ActorPose,
      Texture
    >;
  const facings = () =>
    Object.fromEntries(
      (Object.keys(ACTOR_ART) as Facing[]).map((facing) => [facing, poses(facing)]),
    ) as FacingTextures;
  const workers = Object.fromEntries(
    STAGES.map((stage) => [stage, facings()]),
  ) as ActorTextures["workers"];

  return {
    textures: {
      workers,
      foreman: facings(),
      shadow: texture(),
      crate: texture(),
      glow: texture(),
    },
    sources,
  };
}

describe("destroyActorTextures", () => {
  it("освобождает каждый кадр с его холстом, в том числе кадры, которых нет на спрайтах", () => {
    const { textures, sources } = bakedTextures();

    destroyActorTextures(textures);

    expect(sources.filter((source) => !source.destroyed)).toEqual([]);
  });
});

function workerFrame(overrides: Partial<WorkerFrame> = {}): WorkerFrame {
  return {
    station: "implementation",
    position: { x: 1, y: 1 },
    heading: 0,
    activity: "walk",
    elapsed: 0,
    carrying: true,
    ...overrides,
  };
}

function partFrame(overrides: Partial<PartFrame> = {}): PartFrame {
  return {
    position: { x: 1.45, y: 1 },
    holder: "implementation",
    carried: true,
    status: "ok",
    ...overrides,
  };
}

describe("crateLayerOf", () => {
  it("кладёт деталь в руках над несущим, когда он смотрит вниз", () => {
    const holder = workerFrame({ heading: Math.PI / 2 });
    const holderLayer = PIXELS_PER_UNIT;

    const layer = crateLayerOf(partFrame(), holder);

    expect(layer).toBeGreaterThan(holderLayer);
  });

  it.each([
    ["вверх", -Math.PI / 2],
    ["вправо", 0],
    ["влево", Math.PI],
  ])("кладёт деталь в руках под несущим, когда он смотрит %s", (_direction, heading) => {
    const holder = workerFrame({ heading });
    const holderLayer = PIXELS_PER_UNIT;

    const layer = crateLayerOf(partFrame(), holder);

    expect(layer).toBeLessThan(holderLayer);
  });

  it.each([
    ["вниз", Math.PI / 2],
    ["вверх", -Math.PI / 2],
    ["вбок", 0],
  ])(
    "не ставит деталь между несущим и человеком на соседнем ряду пикселей, %s",
    (_direction, heading) => {
      const holder = workerFrame({ heading });
      const holderLayer = PIXELS_PER_UNIT;

      const layer = crateLayerOf(partFrame(), holder);

      expect(Math.abs(layer - holderLayer)).toBeLessThan(1);
    },
  );

  it("кладёт деталь на станке по её собственному y", () => {
    const part = partFrame({ carried: false, position: { x: 3, y: 2 } });

    const layer = crateLayerOf(part, workerFrame({ heading: Math.PI / 2 }));

    expect(layer).toBe(2 * PIXELS_PER_UNIT);
  });

  it("кладёт деталь по её собственному y, когда несущего нет в кадре", () => {
    const part = partFrame({ position: { x: 3, y: 2 } });

    const layer = crateLayerOf(part, undefined);

    expect(layer).toBe(2 * PIXELS_PER_UNIT);
  });
});
