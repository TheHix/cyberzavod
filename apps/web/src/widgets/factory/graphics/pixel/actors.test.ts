import { STAGES } from "@cyberzavod/core";
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { ACTOR_ART } from "./actor-art.ts";
import { destroyActorTextures, type ActorTextures } from "./actors.ts";
import type { ActorPose, Facing } from "./frames.ts";

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
