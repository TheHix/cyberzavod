// Кабинет мастера: стол с монитором и бумагами и табличка «Мастер». Рисуется один раз
// и дальше не меняется; сам мастер — фигура из actors.ts, она двигается в кадре. Координаты —
// рисунок в точках рисования относительно плана (`UNIT` на единицу).

import type { ConductorPlan } from "@cyberzavod/core";
import { Container, Graphics } from "pixi.js";
import { CONDUCTOR_LABEL } from "@/shared/config/stages.ts";
import { drawPlaque, LABEL_OFFSET } from "./machines.ts";
import { shade, type Palette } from "./palette.ts";
import { UNIT } from "./units.ts";

const DESK = { width: 190, depth: 84, front: 22, radius: 16 } as const;
const OUTLINE = 7;
const DETAIL_OUTLINE = 5;
const SHADOW = { offset: 12, alpha: 0.22 } as const;
const FRONT_SHADE = -0.3;
const MONITOR = { x: -58, y: -34, width: 78, height: 50, radius: 8 } as const;
const PAPERS = { x: 38, y: -30, width: 44, height: 56, radius: 5, tilt: 0.12 } as const;

const HALF_W = DESK.width / 2;
const HALF_D = DESK.depth / 2;

function drawDesk(palette: Palette): Container {
  const shadow = new Graphics()
    .roundRect(-HALF_W, -HALF_D + SHADOW.offset, DESK.width, DESK.depth + DESK.front, DESK.radius)
    .fill({ color: palette.ink, alpha: SHADOW.alpha });
  const top = new Graphics()
    .roundRect(-HALF_W, -HALF_D, DESK.width, DESK.depth + DESK.front, DESK.radius)
    .fill(shade(palette.crate.plank, FRONT_SHADE))
    .stroke({ width: OUTLINE, color: palette.ink })
    .roundRect(-HALF_W, -HALF_D, DESK.width, DESK.depth, DESK.radius)
    .fill(palette.crate.wood)
    .stroke({ width: OUTLINE, color: palette.ink });
  const monitor = new Graphics()
    .roundRect(MONITOR.x, MONITOR.y, MONITOR.width, MONITOR.height, MONITOR.radius)
    .fill(palette.screen)
    .stroke({ width: DETAIL_OUTLINE, color: palette.ink })
    .roundRect(MONITOR.x + 10, MONITOR.y + 12, MONITOR.width - 36, 7, 3)
    .fill(palette.stations.code)
    .roundRect(MONITOR.x + 10, MONITOR.y + 28, MONITOR.width - 20, 7, 3)
    .fill(palette.stations.test);
  const papers = new Graphics()
    .roundRect(PAPERS.x, PAPERS.y, PAPERS.width, PAPERS.height, PAPERS.radius)
    .fill(palette.paper)
    .stroke({ width: DETAIL_OUTLINE, color: palette.ink })
    .moveTo(PAPERS.x + 8, PAPERS.y + 16)
    .lineTo(PAPERS.x + PAPERS.width - 8, PAPERS.y + 16)
    .moveTo(PAPERS.x + 8, PAPERS.y + 30)
    .lineTo(PAPERS.x + PAPERS.width - 8, PAPERS.y + 30)
    .stroke({ width: 3, color: palette.inkSoft });
  papers.rotation = PAPERS.tilt;
  return new Container({ children: [shadow, top, monitor, papers] });
}

/**
 * Рисует кабинет мастера: стол и табличку; координаты — в точках рисования.
 * @param {ConductorPlan} plan Где стол и место мастера.
 * @param {number} textResolution Чёткость текста таблички.
 * @param {Palette} palette Краски цеха.
 * @returns {Container} Кабинет без мастера.
 */
export function drawOffice(
  plan: ConductorPlan,
  textResolution: number,
  palette: Palette,
): Container {
  const desk = drawDesk(palette);
  desk.position.set(plan.desk.x * UNIT, plan.desk.y * UNIT);

  // Табличка — за местом мастера, по ту же сторону от стола, что и он, в одном ряду с табличками
  // нижних станков.
  const awayFromDesk = Math.sign(plan.post.y - plan.desk.y) || 1;
  const plaque = drawPlaque(
    CONDUCTOR_LABEL,
    { x: plan.desk.x * UNIT, y: plan.post.y * UNIT + awayFromDesk * LABEL_OFFSET },
    textResolution,
    palette,
  );
  return new Container({ children: [desk, plaque] });
}
