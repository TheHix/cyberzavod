// Кабинет мастера: стол с монитором и бумагами. Рисуется один раз и дальше не меняется;
// сам мастер — действующее лицо из actors.ts, а табличка — из plaques.ts.

import type { ForemanPlan } from "@cyberzavod/player";
import { Container, Sprite } from "pixi.js";
import { artSize, paintArt, paletteInks, type SpriteArt } from "./art.ts";
import type { Palette } from "./palette.ts";
import { textureOf } from "./textures.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/** Рисунок стола мастера 32×20: дерево, монитор с кодом, клавиатура и бумаги. */
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
 * Рисует кабинет мастера: стол; координаты — в пикселях рисунка.
 * @param {ForemanPlan} plan Где стол и место мастера.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Кабинет без мастера и таблички.
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
