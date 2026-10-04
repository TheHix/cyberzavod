// Цех из простых фигур на PixiJS, вид сверху. Фигуры рисуются один раз при встраивании
// и запекаются в текстуры; в кадре у спрайтов меняются только координаты, поворот и
// прозрачность — без перерисовки и без новых объектов.

import {
  STAGES,
  type FactoryLayout,
  type PartStatus,
  type Point,
  type Scene,
  type Stage,
  type WorkerFrame,
} from "@cyberzavod/core";
import { Application, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { FactoryGraphics, ScreenPoint } from "../factory-graphics.ts";
import { poseOf } from "./pose.ts";

const FULL_TURN = Math.PI * 2;
// Текстуры рисуются с запасом — 96 пикселей на единицу плана: чётко и на широком экране.
const TEXTURE_SCALE = 96;
// Плотность выше двух не видна глазу, а пикселей на холсте вчетверо больше.
const MAX_RESOLUTION = 2;

const STATION_LABELS: Readonly<Record<Stage, string>> = {
  spec: "Постановка",
  code: "Код",
  test: "Проверки",
  review: "Ревью",
  ship: "Выпуск",
};
// Каска у каждого рабочего своего цвета — видно, чей станок.
const HELMET_COLORS: Readonly<Record<Stage, number>> = {
  spec: 0x7aa2f7,
  code: 0xff9f1c,
  test: 0x9ece6a,
  review: 0xbb9af7,
  ship: 0x2ac3de,
};
const PART_COLORS: Readonly<Record<PartStatus, number>> = {
  ok: 0xe6c07b,
  defect: 0xf7768e,
  done: 0x9ece6a,
  scrap: 0x565f89,
};
const SHIRT_COLOR = 0x5b6478;
const SKIN_COLOR = 0xd8a47f;
const OUTLINE_COLOR = 0x1a1b26;

// Размеры — в единицах плана.
const GRID = { width: 0.02, alpha: 0.6 } as const;
const MACHINE = { width: 2.2, height: 1, radius: 0.18, border: 0.04, inset: 0.2 } as const;
const MACHINE_PANEL = { radius: 0.08, alpha: 0.18 } as const;
// Подсветка станка, у которого работают: рамка вокруг, мягко дышит.
const GLOW = { margin: 0.08, radius: 0.24, width: 0.06, periodMs: 900 } as const;
const GLOW_ALPHA = { base: 0.55, swing: 0.25 } as const;
const SHOULDERS = { depth: 0.2, width: 0.34 } as const;
const HELMET_RADIUS = 0.17;
const HAND_RADIUS = 0.08;
const HAND_SPREAD = 0.22;
const PART = { size: 0.34, border: 0.04, seam: 0.03, seamAlpha: 0.5 } as const;
// Подпись станка — со стороны, противоположной рабочему, на таком расстоянии от центра.
const LABEL_OFFSET = 0.85;
// Шрифт подписи растёт с масштабом плана, но остаётся читаемым и не кричит.
const LABEL_FONT_PER_UNIT = 0.26;
const LABEL_FONT = { min: 10, max: 14 } as const;

interface Theme {
  floor: string;
  line: string;
  surface: string;
  text: string;
  accent: string;
}

interface WorkerSprites {
  readonly root: Container;
  readonly leftHand: Sprite;
  readonly rightHand: Sprite;
}

function themeOf(element: HTMLElement): Theme {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    floor: read("--bg", "#0d0f12"),
    line: read("--line", "#262b33"),
    surface: read("--surface", "#14171c"),
    text: read("--muted", "#8a919c"),
    accent: read("--accent", "#ff9f1c"),
  };
}

/** Графика цеха из фигур, нарисованных кодом. */
export class ShapesGraphics implements FactoryGraphics {
  readonly #app = new Application();
  readonly #world = new Container();
  readonly #labels = new Container();
  readonly #workers = new Map<Stage, WorkerSprites>();
  readonly #glows = new Map<Stage, Graphics>();
  readonly #stationLabels = new Map<Stage, Text>();
  #part: Sprite | undefined;
  #layout: FactoryLayout | undefined;
  #scale = 1;
  #offset: ScreenPoint = { x: 0, y: 0 };
  #mounted = false;

  /**
   * Встраивает холст в контейнер и рисует неподвижный план цеха.
   * @param {HTMLElement} container Элемент, в который встаёт холст.
   * @param {FactoryLayout} layout План цеха.
   * @returns {Promise<void>} Готово, когда холст встроен.
   * @throws {Error} Если не удалось создать рендерер или нарисовать план.
   */
  async mount(container: HTMLElement, layout: FactoryLayout): Promise<void> {
    this.#layout = layout;
    await this.#app.init({
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
      // Кадр рисуется по подписке на сцену модели, только когда она меняется: свой цикл
      // Pixi не нужен.
      autoStart: false,
      preference: "webgl",
    });
    this.#mounted = true;
    this.#app.canvas.setAttribute("aria-hidden", "true");
    container.append(this.#app.canvas);

    const theme = themeOf(container);
    this.#world.addChild(this.#drawFloor(layout, theme));
    for (const stage of STAGES) this.#addStation(stage, layout, theme);
    const textures = this.#bakeTextures();
    for (const stage of STAGES) this.#addWorker(stage, textures);
    this.#part = this.#centered(textures.part);
    this.#world.addChild(this.#part);
    this.#app.stage.addChild(this.#world, this.#labels);
    this.resize(container.clientWidth, container.clientHeight);
  }

  /**
   * Рисует кадр сцены.
   * @param {Scene} scene Кадр цеха.
   */
  render(scene: Scene): void {
    for (const worker of scene.workers) this.#placeWorker(worker);
    this.#placePart(scene);
    const glow =
      GLOW_ALPHA.base + GLOW_ALPHA.swing * Math.sin((scene.time / GLOW.periodMs) * FULL_TURN);
    for (const [stage, graphics] of this.#glows) {
      const working = scene.part.holder === stage && !scene.part.carried && !scene.finished;
      graphics.alpha = working ? glow : 0;
    }
    this.#app.render();
  }

  /**
   * Подстраивает холст и масштаб плана под размер контейнера.
   * @param {number} width Ширина контейнера, CSS-пиксели.
   * @param {number} height Высота контейнера, CSS-пиксели.
   */
  resize(width: number, height: number): void {
    const layout = this.#layout;
    if (!this.#mounted || layout === undefined) return;
    this.#app.renderer.resize(width, height);
    this.#scale = Math.min(width / layout.width, height / layout.height);
    this.#offset = {
      x: (width - layout.width * this.#scale) / 2,
      y: (height - layout.height * this.#scale) / 2,
    };
    this.#world.scale.set(this.#scale);
    this.#world.position.set(this.#offset.x, this.#offset.y);

    const fontSize = Math.min(
      LABEL_FONT.max,
      Math.max(LABEL_FONT.min, this.#scale * LABEL_FONT_PER_UNIT),
    );
    for (const [stage, label] of this.#stationLabels) {
      const { x, y } = this.toScreen(labelPoint(layout, stage));
      label.style.fontSize = fontSize;
      label.position.set(x, y);
    }
  }

  /**
   * Переводит точку плана в координаты контейнера.
   * @param {Point} point Точка плана.
   * @returns {ScreenPoint} Точка в CSS-пикселях от левого верхнего угла контейнера.
   */
  toScreen(point: Point): ScreenPoint {
    return { x: this.#offset.x + point.x * this.#scale, y: this.#offset.y + point.y * this.#scale };
  }

  /** Убирает холст и освобождает текстуры. */
  destroy(): void {
    if (!this.#mounted) return;
    this.#app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    this.#mounted = false;
  }

  #drawFloor(layout: FactoryLayout, theme: Theme): Graphics {
    const floor = new Graphics().rect(0, 0, layout.width, layout.height).fill(theme.floor);
    for (let x = 1; x < layout.width; x++) floor.moveTo(x, 0).lineTo(x, layout.height);
    for (let y = 1; y < layout.height; y++) floor.moveTo(0, y).lineTo(layout.width, y);
    return floor.stroke({ width: GRID.width, color: theme.line, alpha: GRID.alpha });
  }

  #addStation(stage: Stage, layout: FactoryLayout, theme: Theme): void {
    const { machine } = layout.stations[stage];
    const left = machine.x - MACHINE.width / 2;
    const top = machine.y - MACHINE.height / 2;
    const { inset } = MACHINE;
    const body = new Graphics()
      .roundRect(left, top, MACHINE.width, MACHINE.height, MACHINE.radius)
      .fill(theme.surface)
      .stroke({ width: MACHINE.border, color: theme.line })
      .roundRect(
        left + inset,
        top + inset,
        MACHINE.width - inset * 2,
        MACHINE.height - inset * 2,
        MACHINE_PANEL.radius,
      )
      .fill({ color: HELMET_COLORS[stage], alpha: MACHINE_PANEL.alpha });
    const { margin } = GLOW;
    const glow = new Graphics()
      .roundRect(
        left - margin,
        top - margin,
        MACHINE.width + margin * 2,
        MACHINE.height + margin * 2,
        GLOW.radius,
      )
      .stroke({ width: GLOW.width, color: theme.accent });
    glow.alpha = 0;
    this.#world.addChild(body, glow);
    this.#glows.set(stage, glow);

    const label = new Text({
      text: STATION_LABELS[stage],
      style: { fill: theme.text, fontFamily: "system-ui, sans-serif", fontSize: LABEL_FONT.min },
      resolution: this.#app.renderer.resolution,
      anchor: 0.5,
    });
    this.#labels.addChild(label);
    this.#stationLabels.set(stage, label);
  }

  // Фигуры рисуются в крупном масштабе и запекаются: спрайт с текстурой дешевле графики,
  // и все рабочие рисуются одним пакетом.
  #bakeTextures(): Record<"shoulders" | "helmet" | "hand" | "part", Texture> {
    const bake = (graphics: Graphics) => {
      const texture = this.#app.renderer.generateTexture({
        target: graphics,
        resolution: this.#app.renderer.resolution,
        antialias: true,
      });
      graphics.destroy();
      return texture;
    };
    const unit = TEXTURE_SCALE;
    return {
      shoulders: bake(
        new Graphics()
          .ellipse(0, 0, SHOULDERS.depth * unit, SHOULDERS.width * unit)
          .fill(SHIRT_COLOR),
      ),
      // Каска белая: цвет станка даёт tint спрайта.
      helmet: bake(new Graphics().circle(0, 0, HELMET_RADIUS * unit).fill(0xffffff)),
      hand: bake(new Graphics().circle(0, 0, HAND_RADIUS * unit).fill(SKIN_COLOR)),
      // Ящик белый: цвет состояния детали даёт tint спрайта. Шов — крест: ящик выглядит
      // одинаково при повороте на 90°, и смена «на станке ↔ в руках» не заметна.
      part: bake(
        new Graphics()
          .rect(0, 0, PART.size * unit, PART.size * unit)
          .fill(0xffffff)
          .stroke({ width: PART.border * unit, color: OUTLINE_COLOR })
          .moveTo(0, 0)
          .lineTo(PART.size * unit, PART.size * unit)
          .moveTo(PART.size * unit, 0)
          .lineTo(0, PART.size * unit)
          .stroke({ width: PART.seam * unit, color: OUTLINE_COLOR, alpha: PART.seamAlpha }),
      ),
    };
  }

  #centered(texture: Texture): Sprite {
    const sprite = new Sprite({ texture, anchor: 0.5 });
    sprite.scale.set(1 / TEXTURE_SCALE);
    return sprite;
  }

  #addWorker(stage: Stage, textures: Record<"shoulders" | "helmet" | "hand", Texture>): void {
    const leftHand = this.#centered(textures.hand);
    const rightHand = this.#centered(textures.hand);
    const shoulders = this.#centered(textures.shoulders);
    const helmet = this.#centered(textures.helmet);
    helmet.tint = HELMET_COLORS[stage];
    // Руки под плечами: видны, только когда вынесены вперёд.
    const root = new Container({ children: [leftHand, rightHand, shoulders, helmet] });
    this.#world.addChild(root);
    this.#workers.set(stage, { root, leftHand, rightHand });
  }

  #placeWorker(worker: WorkerFrame): void {
    const sprites = this.#workers.get(worker.station);
    if (sprites === undefined) return;
    const pose = poseOf(worker);
    sprites.root.position.set(worker.position.x, worker.position.y);
    sprites.root.rotation = worker.heading;
    sprites.root.scale.set(1 + pose.bob);
    sprites.leftHand.position.set(pose.reach + pose.swing, -HAND_SPREAD);
    sprites.rightHand.position.set(pose.reach - pose.swing, HAND_SPREAD);
  }

  #placePart(scene: Scene): void {
    const part = this.#part;
    if (part === undefined) return;
    const carrier = scene.workers.find((worker) => worker.station === scene.part.holder);
    part.position.set(scene.part.position.x, scene.part.position.y);
    part.rotation = scene.part.carried && carrier !== undefined ? carrier.heading : 0;
    part.tint = PART_COLORS[scene.part.status];
  }
}

function labelPoint(layout: FactoryLayout, stage: Stage): Point {
  const { machine, post } = layout.stations[stage];
  const awayFromWorker = Math.sign(machine.y - post.y);
  return { x: machine.x, y: machine.y + awayFromWorker * LABEL_OFFSET };
}
