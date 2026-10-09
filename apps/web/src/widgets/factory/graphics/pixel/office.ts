// The foreman's office: a desk with a monitor and papers. Drawn once and does not change after;
// the foreman is an actor from actors.ts, and the plaque comes from plaques.ts.

import type { ForemanPlan } from "@cyberzavod/player";
import { Container, Sprite } from "pixi.js";
import { artSize, paintArt, paletteInks, type SpriteArt } from "./art.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** Foreman desk sprite 32×20: wood, a monitor with code, a keyboard and papers. */
export const DESK_ART: SpriteArt = [
  ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  "kyyyyyyyyyyyyyyyyyyyyyyyyyyyyywk",
  "kywkkkkkkkkkkkkkkwwwwwwwwwwwwwWk",
  "kywkggggggggggggkwwwkkkkkkkkkwWk",
  "kywkg222222gggggkwwwkpppppppkwWk",
  "kywkggggggggggggkwwwkpiiiiipkwWk",
  "kywkg333333333ggkwwwkpppppppkwWk",
  "kywkggggggggggggkwwwkpiiiiipkwWk",
  "kywkg1111gggggggkwwwkpppppppkwWk",
  "kywkkkkkkkkkkkkkkwwwkpiiiiipkwWk",
  "kywwwwwwkkkkwwwwwwwwkpppppppkwWk",
  "kywkkkkkkkkkkkkkkwwwkpppp22pkwWk",
  "kywkpPpPpPpPpPpPkwwwkkkkkkkkkwWk",
  "kywkkkkkkkkkkkkkkwwwwwwwwwwwwwWk",
  "kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kWWWkkkkkkkkkWWWWWWWkkkkkkkkkWWk",
  "kWWWkWWWWWyWkWWWWWWWkWWyWWWWkWWk",
  "kWWWkkkkkkkkkWWWWWWWkkkkkkkkkWWk",
  ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
];

/**
 * Draws the foreman's office: the desk; coordinates are in sprite pixels.
 * @param {ForemanPlan} plan Where the desk and the foreman spot are.
 * @param {Palette} palette Factory inks.
 * @returns {Container} The office without the foreman and the plaque.
 */
export function drawOffice(plan: ForemanPlan, palette: Palette): Container {
  const desk = new Sprite(textureOf(paintArt(DESK_ART, paletteInks(palette))));
  const { width, height } = artSize(DESK_ART);

  desk.position.set(
    Math.round(plan.desk.x * PIXELS_PER_UNIT) - Math.floor(width / 2),
    Math.round(plan.desk.y * PIXELS_PER_UNIT) - Math.floor(height / 2),
  );

  return new Container({ children: [desk] });
}
