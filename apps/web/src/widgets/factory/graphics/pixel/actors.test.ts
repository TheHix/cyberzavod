import { STAGES, type Stage } from "@cyberzavod/core";
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { destroyActorTextures, type ActorTextures } from "./actors.ts";

// Текстуры той же формы, что у `bakeActorTextures`, но без DOM-холста; холсты видны тесту.
function bakedTextures(): { textures: ActorTextures; sources: TextureSource[] } {
  const sources: TextureSource[] = [];
  const texture = () => {
    const source = new TextureSource();
    sources.push(source);
    return new Texture({ source });
  };
  const poses = () => ({ stand: texture(), walkA: texture(), walkB: texture() });
  const facings = () => ({ down: poses(), up: poses(), side: poses() });
  const workers = Object.fromEntries(STAGES.map((stage) => [stage, facings()])) as Record<
    Stage,
    ReturnType<typeof facings>
  >;
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
