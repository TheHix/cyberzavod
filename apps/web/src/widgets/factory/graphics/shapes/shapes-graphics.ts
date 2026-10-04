// Цех в стиле тайкуна на PixiJS, вид сверху. Всё рисуется один раз при встраивании (пол,
// станки, кабинет мастера, текстуры рабочих, мастера и детали); в кадре у готовых спрайтов
// меняются только координаты, поворот, масштаб и прозрачность — без перерисовки и без новых
// объектов.

import { STAGES, type FactoryLayout, type Point, type Scene, type Stage } from "@cyberzavod/core";
import { Application, Container } from "pixi.js";
import type { FactoryGraphics, Frame, ScreenPoint } from "../factory-graphics.ts";
import {
  bakeActorTextures,
  createConductor,
  createCrate,
  createWorker,
  placeConductor,
  placeCrate,
  placeWorker,
  type CrateSprites,
  type WorkerSprites,
} from "./actors.ts";
import { fitPlan, planBounds, type PlanBounds } from "./bounds.ts";
import { drawFloor } from "./floor.ts";
import { drawMachine, loadPlaqueFont, type MachineSprites } from "./machines.ts";
import { drawOffice } from "./office.ts";
import { readPalette } from "./palette.ts";
import { UNIT } from "./units.ts";

// Плотность выше двух не видна глазу, а пикселей на холсте вчетверо больше.
const MAX_RESOLUTION = 2;
// Текст табличек рисуется с запасом чёткости: мир масштабируется под экран.
const TEXT_SHARPNESS = 2;
const FULL_TURN = Math.PI * 2;
// Станок, у которого работают, «качает» корпусом и мигает лампой.
const PUMP = { periodMs: 700, swing: 0.035 } as const;
const LAMP_BLINK = { periodMs: 900, base: 0.75, swing: 0.25 } as const;

/** Графика цеха в стиле тайкуна из фигур, нарисованных кодом. */
export class ShapesGraphics implements FactoryGraphics {
  readonly #app = new Application();
  readonly #world = new Container();
  readonly #workers = new Map<Stage, WorkerSprites>();
  readonly #machines = new Map<Stage, MachineSprites>();
  #conductor: WorkerSprites | undefined;
  #crate: CrateSprites | undefined;
  #bounds: PlanBounds | undefined;
  #scale = 1;
  #offset: ScreenPoint = { x: 0, y: 0 };
  #mounted = false;

  /**
   * Встраивает холст в контейнер и рисует неподвижный цех: пол, станки, кабинет мастера, таблички.
   * @param {HTMLElement} container Элемент, в который встаёт холст.
   * @param {FactoryLayout} layout План цеха.
   * @returns {Promise<void>} Готово, когда холст встроен.
   * @throws {Error} Если не удалось создать рендерер или нарисовать план.
   */
  async mount(container: HTMLElement, layout: FactoryLayout): Promise<void> {
    this.#bounds = planBounds(layout);
    await Promise.all([
      this.#app.init({
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
      }),
      // Таблички пишутся шрифтом сайта — он должен быть загружен до первой надписи.
      loadPlaqueFont(),
    ]);
    this.#mounted = true;
    this.#app.canvas.setAttribute("aria-hidden", "true");
    container.append(this.#app.canvas);

    const { renderer } = this.#app;
    // Краски — из токенов оформления, как у интерфейса.
    const palette = readPalette(getComputedStyle(container));
    this.#world.addChild(drawFloor(layout, renderer, palette));
    for (const stage of STAGES) {
      const machine = drawMachine(
        stage,
        layout.stations[stage],
        renderer.resolution * TEXT_SHARPNESS,
        palette,
      );
      this.#world.addChild(machine.root);
      this.#machines.set(stage, machine.sprites);
    }
    this.#world.addChild(
      drawOffice(layout.conductor, renderer.resolution * TEXT_SHARPNESS, palette),
    );
    const textures = bakeActorTextures(renderer, palette);
    for (const stage of STAGES) {
      const worker = createWorker(stage, textures, palette);
      this.#world.addChild(worker.root);
      this.#workers.set(stage, worker);
    }
    this.#conductor = createConductor(textures, palette);
    this.#world.addChild(this.#conductor.root);
    this.#crate = createCrate(textures, palette);
    this.#world.addChild(this.#crate.root);
    this.#app.stage.addChild(this.#world);
    const { clientWidth: width, clientHeight: height } = container;
    this.resize(width, height, { x: 0, y: 0, width, height });
  }

  /**
   * Рисует кадр сцены.
   * @param {Scene} scene Кадр цеха.
   */
  render(scene: Scene): void {
    for (const worker of scene.workers) {
      const sprites = this.#workers.get(worker.station);
      if (sprites !== undefined) placeWorker(sprites, worker);
    }
    if (this.#conductor !== undefined) placeConductor(this.#conductor, scene.conductor);
    const carrier = scene.workers.find((worker) => worker.station === scene.part.holder);
    if (this.#crate !== undefined) {
      placeCrate(this.#crate, scene.part, carrier?.heading ?? 0, scene.time);
    }
    const pump = 1 + PUMP.swing * Math.sin((scene.time / PUMP.periodMs) * FULL_TURN);
    const lamp =
      LAMP_BLINK.base + LAMP_BLINK.swing * Math.sin((scene.time / LAMP_BLINK.periodMs) * FULL_TURN);
    for (const [stage, machine] of this.#machines) {
      const working = scene.part.holder === stage && !scene.part.carried && !scene.finished;
      machine.body.scale.set(1, working ? pump : 1);
      machine.lampOn.alpha = working ? lamp : 0;
    }
    this.#app.render();
  }

  /**
   * Подстраивает холст под контейнер и вписывает план в поле.
   * @param {number} width Ширина контейнера, CSS-пиксели.
   * @param {number} height Высота контейнера, CSS-пиксели.
   * @param {Frame} frame Поле, свободное от меню и HUD, — туда встаёт план.
   */
  resize(width: number, height: number, frame: Frame): void {
    const bounds = this.#bounds;
    if (!this.#mounted || bounds === undefined) return;
    this.#app.renderer.resize(width, height);
    // Вписывается нарисованный цех, а не план с пустыми краями: так он крупнее.
    const fit = fitPlan(bounds, frame);
    this.#scale = fit.scale;
    this.#offset = fit.offset;
    this.#world.scale.set(this.#scale / UNIT);
    this.#world.position.set(this.#offset.x, this.#offset.y);
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
}
