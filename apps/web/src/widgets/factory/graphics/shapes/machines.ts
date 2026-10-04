// Станки в стиле тайкуна: пухлый корпус с толстым контуром и тёмной передней гранью, на крышке —
// свой декор у каждого этапа, лампа и табличка с названием. Рисуются один раз; в кадре у станка
// меняются только масштаб корпуса («качает» при работе) и яркость лампы. Координаты декора —
// рисунок в точках рисования относительно центра станка.

import type { Point, Stage, StationPlan } from "@cyberzavod/core";
import { Container, Graphics, Text } from "pixi.js";
import { shade, type Palette } from "./palette.ts";
import { UNIT } from "./units.ts";

/** Станок в кадре: корпус «качает» при работе, лампа загорается. */
export interface MachineSprites {
  readonly body: Container;
  readonly lampOn: Container;
}

const STATION_LABELS: Readonly<Record<Stage, string>> = {
  spec: "Постановка",
  code: "Код",
  test: "Проверки",
  review: "Ревью",
  ship: "Выпуск",
};

/** Шрифт табличек — шрифт заголовков сайта. */
export const PLAQUE_FONT = { family: "Rubik Variable", weight: "800", size: 30 } as const;

/**
 * Загружает шрифт табличек со всеми их буквами: шрифт разбит по алфавитам, и без текста
 * браузер загрузил бы только латиницу, а таблички — кириллические.
 * @returns {Promise<unknown>} Готово, когда шрифт с кириллицей загружен.
 */
export function loadPlaqueFont(): Promise<unknown> {
  const { weight, size, family } = PLAQUE_FONT;
  return document.fonts.load(
    `${weight} ${size}px "${family}"`,
    Object.values(STATION_LABELS).join(""),
  );
}

// Размеры в точках рисования.
const BODY = { width: 240, depth: 110, front: 28, radius: 26 } as const;
const OUTLINE = 7;
const DETAIL_OUTLINE = 5;
const SHADOW = { offset: 12, alpha: 0.22 } as const;
const LAMP_SIZE = { radius: 14, halo: 32, haloAlpha: 0.4 } as const;
const PLAQUE = { padX: 18, padY: 8, radius: 14, outline: 5, shadow: 6 } as const;
// Подпись — со стороны, противоположной рабочему, на таком расстоянии от центра станка.
const LABEL_OFFSET = 1.05 * UNIT;
/** Насколько табличка уходит от центра станка, точки рисования: по нему считаются границы цеха. */
export const PLAQUE_REACH = LABEL_OFFSET + PLAQUE_FONT.size / 2 + PLAQUE.padY + PLAQUE.shadow;
const FRONT_SHADE = -0.35;
const LIGHT_SHADE = 0.55;
const HAZARD_STRIPE = 22;
const WHITE = 0xffffff;

const HALF_W = BODY.width / 2;
const HALF_D = BODY.depth / 2;

// Декор крышки по этапу: чертёж, терминал, пробирки, лупа, конвейер. Новый этап — новая строка.
const DECOR: Readonly<Record<Stage, (palette: Palette) => Container>> = {
  spec: (palette) => {
    const sheet = new Graphics()
      .roundRect(-95, -38, 135, 76, 10)
      .fill(palette.screenGlass)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
    for (let x = -75; x < 40; x += 20) sheet.moveTo(x, -33).lineTo(x, 33);
    for (let y = -18; y < 38; y += 20) sheet.moveTo(-90, y).lineTo(35, y);
    return sheet
      .stroke({ width: 3, color: palette.stations.spec, alpha: 0.7 })
      .roundRect(58, -34, 20, 68, 7)
      .fill(palette.helmet)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
  },
  code: (palette) => {
    const terminal = new Graphics()
      .roundRect(-98, -40, 150, 62, 10)
      .fill(palette.screen)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
    const lines = [
      [-86, -28, 60, palette.stations.test],
      [-86, -14, 90, palette.stations.spec],
      [-74, 0, 52, palette.stations.code],
      [-74, 12, 70, palette.lamp.on],
    ] as const;
    for (const [x, y, width, fill] of lines) terminal.roundRect(x, y, width, 7, 3).fill(fill);
    return terminal
      .roundRect(-98, 28, 150, 16, 6)
      .fill(shade(palette.stations.code, LIGHT_SHADE))
      .stroke({ width: 4, color: palette.ink })
      .circle(80, -8, 16)
      .fill(palette.paper)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
  },
  test: (palette) => {
    const rig = new Graphics()
      .roundRect(-98, -40, 112, 76, 10)
      .fill(palette.screen)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink })
      .moveTo(-66, -2)
      .lineTo(-48, 16)
      .lineTo(-14, -20)
      .stroke({ width: 10, color: palette.stations.test, cap: "round", join: "round" });
    for (const [x, liquid] of [
      [36, palette.stations.spec],
      [70, palette.stations.ship],
    ] as const) {
      rig
        .roundRect(x, -40, 24, 76, 12)
        .fill(WHITE)
        .roundRect(x, -2, 24, 38, 12)
        .fill(liquid)
        .roundRect(x, -40, 24, 76, 12)
        .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
    }
    return rig;
  },
  review: (palette) =>
    new Graphics()
      .roundRect(30, -40, 76, 56, 8)
      .fill(palette.screen)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink })
      .circle(52, -12, 7)
      .fill(palette.stations.test)
      .circle(78, -12, 7)
      .fill(palette.lamp.on)
      .moveTo(-6, 22)
      .lineTo(22, 44)
      .stroke({ width: 14, color: palette.ink, cap: "round" })
      .circle(-34, -4, 40)
      .fill(palette.screenGlass)
      .stroke({ width: OUTLINE, color: palette.ink })
      .arc(-34, -4, 26, Math.PI * 1.1, Math.PI * 1.45)
      .stroke({ width: 6, color: WHITE, cap: "round" }),
  ship: (palette) => {
    const dock = new Graphics()
      .roundRect(-108, -32, 216, 64, 12)
      .fill(palette.belt)
      .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
    for (let x = -84; x < 108; x += 28) dock.moveTo(x, -26).lineTo(x, 26);
    dock.stroke({ width: 6, color: palette.inkSoft });
    for (const x of [-70, 20]) {
      dock
        .roundRect(x, -20, 44, 40, 6)
        .fill(palette.crate.wood)
        .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
    }
    // Чёрно-жёлтые полосы по передней грани — погрузочная зона.
    const stripes = new Graphics();
    for (let x = -HALF_W + 18, index = 0; x < HALF_W - 18; x += HAZARD_STRIPE, index++) {
      stripes
        .rect(x, HALF_D + 6, HAZARD_STRIPE, BODY.front - 12)
        .fill(index % 2 === 0 ? palette.helmet : palette.ink);
    }
    return new Container({ children: [dock, stripes] });
  },
};

function drawBody(stage: Stage, palette: Palette): Container {
  const color = palette.stations[stage];
  const box = new Graphics()
    .roundRect(-HALF_W, -HALF_D, BODY.width, BODY.depth + BODY.front, BODY.radius)
    .fill(shade(color, FRONT_SHADE))
    .stroke({ width: OUTLINE, color: palette.ink })
    .roundRect(-HALF_W, -HALF_D, BODY.width, BODY.depth, BODY.radius)
    .fill(color)
    .stroke({ width: OUTLINE, color: palette.ink });
  const lampOff = new Graphics()
    .circle(HALF_W - 24, -HALF_D + 2, LAMP_SIZE.radius)
    .fill(palette.lamp.off)
    .stroke({ width: DETAIL_OUTLINE, color: palette.ink });
  // Корпус «качает» от основания: точка опоры — низ передней грани.
  const body = new Container({ children: [box, DECOR[stage](palette), lampOff] });
  body.pivot.set(0, HALF_D + BODY.front);
  body.position.set(0, HALF_D + BODY.front);
  return body;
}

function drawLampOn(palette: Palette): Container {
  const lamp = new Container({
    children: [
      new Graphics()
        .circle(HALF_W - 24, -HALF_D + 2, LAMP_SIZE.halo)
        .fill({ color: palette.lamp.on, alpha: LAMP_SIZE.haloAlpha }),
      new Graphics()
        .circle(HALF_W - 24, -HALF_D + 2, LAMP_SIZE.radius)
        .fill(palette.lamp.on)
        .stroke({ width: DETAIL_OUTLINE, color: palette.ink }),
    ],
  });
  lamp.alpha = 0;
  return lamp;
}

function drawPlaque(text: string, at: Point, resolution: number, palette: Palette): Container {
  const label = new Text({
    text,
    anchor: 0.5,
    resolution,
    style: {
      fontFamily: PLAQUE_FONT.family,
      fontWeight: PLAQUE_FONT.weight,
      fontSize: PLAQUE_FONT.size,
      fill: palette.ink,
    },
  });
  const width = label.width + PLAQUE.padX * 2;
  const height = label.height + PLAQUE.padY * 2;
  const plate = new Graphics()
    .roundRect(-width / 2, -height / 2 + PLAQUE.shadow, width, height, PLAQUE.radius)
    .fill(palette.ink)
    .roundRect(-width / 2, -height / 2, width, height, PLAQUE.radius)
    .fill(palette.paper)
    .stroke({ width: PLAQUE.outline, color: palette.ink });
  const plaque = new Container({ children: [plate, label] });
  plaque.position.set(at.x, at.y);
  return plaque;
}

/**
 * Рисует станок этапа с табличкой; координаты — в точках рисования (`UNIT` на единицу плана).
 * @param {Stage} stage Этап станка.
 * @param {StationPlan} plan Где станок и его рабочий.
 * @param {number} textResolution Чёткость текста таблички.
 * @param {Palette} palette Краски цеха.
 * @returns {{ root: Container, sprites: MachineSprites }} Станок целиком и его подвижные части.
 */
export function drawMachine(
  stage: Stage,
  plan: StationPlan,
  textResolution: number,
  palette: Palette,
): { root: Container; sprites: MachineSprites } {
  const shadow = new Graphics()
    .roundRect(-HALF_W, -HALF_D + SHADOW.offset, BODY.width, BODY.depth + BODY.front, BODY.radius)
    .fill({ color: palette.ink, alpha: SHADOW.alpha });
  const body = drawBody(stage, palette);
  const lampOn = drawLampOn(palette);
  const machine = new Container({ children: [shadow, body, lampOn] });
  machine.position.set(plan.machine.x * UNIT, plan.machine.y * UNIT);

  // Табличка — со стороны, противоположной рабочему; если они на одной высоте — над станком.
  const awayFromWorker = Math.sign(plan.machine.y - plan.post.y) || -1;
  const plaque = drawPlaque(
    STATION_LABELS[stage],
    { x: plan.machine.x * UNIT, y: plan.machine.y * UNIT + awayFromWorker * LABEL_OFFSET },
    textResolution,
    palette,
  );
  return { root: new Container({ children: [machine, plaque] }), sprites: { body, lampOn } };
}
