import { Sprite } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { MachineWork, WorkBeat } from "./frames.ts";
import { MACHINE_WORK_ART, showMachineWork, type MachineSprites } from "./machines.ts";

// Beats are taken by the keys of the overlay table: a new beat gets into the test by itself.
const BEATS = Object.keys(MACHINE_WORK_ART.planning.frames) as WorkBeat[];

// Real Pixi sprites without textures: visibility is their own property, no canvas needed.
function machineSprites(lampOn = true): MachineSprites {
  const work = Object.fromEntries(BEATS.map((beat) => [beat, new Sprite()])) as Record<
    WorkBeat,
    Sprite
  >;

  return { work, lampOn: new Sprite({ visible: lampOn }) };
}

function visibleBeats(sprites: MachineSprites): string[] {
  return Object.entries(sprites.work)
    .filter(([, sprite]) => sprite.visible)
    .map(([beat]) => beat);
}

describe("showMachineWork", () => {
  it.each(BEATS)("показывает только накладку такта %s", (beat) => {
    const sprites = machineSprites();

    showMachineWork(sprites, beat);

    expect(visibleBeats(sprites)).toEqual([beat]);
  });

  it("в покое прячет все накладки", () => {
    const sprites = machineSprites();

    showMachineWork(sprites, "rest");

    expect(visibleBeats(sprites)).toEqual([]);
  });

  const LAMP_CASES = [true, false].flatMap((lampOn) =>
    [...BEATS, "rest" as const].map((work): [MachineWork, boolean] => [work, lampOn]),
  );

  it.each(LAMP_CASES)("при %s не трогает лампу (горит: %s)", (work, lampOn) => {
    const sprites = machineSprites(lampOn);

    showMachineWork(sprites, work);

    expect(sprites.lampOn.visible).toBe(lampOn);
  });
});
