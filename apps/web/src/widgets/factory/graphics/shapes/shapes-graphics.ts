// Цех в стиле тайкуна на PixiJS, вид сверху. Всё рисуется при встраивании (пол, станки,
// кабинет мастера, текстуры рабочих, мастера и детали) и заново только при смене плана; в кадре
// у готовых спрайтов меняются только координаты, поворот, масштаб и прозрачность — без
// перерисовки и без новых объектов.

import { STAGES, type FactoryLayout, type Point, type Scene, type Stage } from "@cyberzavod/core";
import { Container, isWebGLSupported } from "pixi.js";
import type { FactoryGraphics, Frame, ScreenPoint } from "../factory-graphics.ts";
import {
  bakeActorTextures,
  createForeman,
  createCrate,
  createWorker,
  placeForeman,
  placeCrate,
  placeWorker,
  type CrateSprites,
  type WorkerSprites,
} from "./actors.ts";
import { fitPlan, planBounds, type PlanBounds } from "./bounds.ts";
import { drawFloor } from "./floor.ts";
import { drawMachine, loadPlaqueFont, type MachineSprites } from "./machines.ts";
import { drawOffice } from "./office.ts";
import { readPalette, type Palette } from "./palette.ts";
import { createRenderer, type FactoryRenderer } from "./renderer.ts";
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
  readonly #renderer: FactoryRenderer = createRenderer(isWebGLSupported());
  readonly #stage = new Container();
  readonly #world = new Container();
  // Неподвижный план — пол, станки, кабинет: при смене плана он заменяется целиком.
  #plan: Container | undefined;
  #palette: Palette | undefined;
  readonly #workers = new Map<Stage, WorkerSprites>();
  readonly #machines = new Map<Stage, MachineSprites>();
  #foreman: WorkerSprites | undefined;
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
    await Promise.all([
      this.#renderer.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
        // Расширения Pixi для браузера (события, доступность, DOM, фильтры) цеху не нужны:
        // холст скрыт от доступности, а текст и клики живут в HTML поверх. Понадобится какое-то —
        // подключать явным импортом `pixi.js/<модуль>`.
        manageImports: false,
      }),
      // Таблички пишутся шрифтом сайта — он должен быть загружен до первой надписи.
      loadPlaqueFont(),
    ]);
    this.#mounted = true;
    this.#renderer.canvas.setAttribute("aria-hidden", "true");
    container.append(this.#renderer.canvas);

    const renderer = this.#renderer;
    // Краски — из токенов оформления, как у интерфейса.
    const palette = readPalette(getComputedStyle(container));
    this.#palette = palette;
    this.#drawPlan(layout);
    const textures = bakeActorTextures(renderer, palette);
    for (const stage of STAGES) {
      const worker = createWorker(stage, textures, palette);
      this.#world.addChild(worker.root);
      this.#workers.set(stage, worker);
    }
    this.#foreman = createForeman(textures, palette);
    this.#world.addChild(this.#foreman.root);
    this.#crate = createCrate(textures, palette);
    this.#world.addChild(this.#crate.root);
    this.#stage.addChild(this.#world);
    const { clientWidth: width, clientHeight: height } = container;
    this.resize(width, height, { x: 0, y: 0, width, height });
  }

  /**
   * Заменяет неподвижный план — пол, станки и кабинет. Рабочие, мастер и деталь остаются.
   * Вписывает новый план следующий `resize`: вызывающий всё равно меряет поле заново.
   * @param {FactoryLayout} layout Новый план цеха.
   */
  setLayout(layout: FactoryLayout): void {
    if (!this.#mounted) return;
    this.#plan?.destroy({ children: true, texture: true, textureSource: true });
    this.#machines.clear();
    this.#drawPlan(layout);
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
    if (this.#foreman !== undefined) placeForeman(this.#foreman, scene.foreman);
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
    this.#renderer.render(this.#stage);
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
    this.#renderer.resize(width, height);
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

  // План рисуется под рабочими, мастером и деталью: он первый в мире.
  #drawPlan(layout: FactoryLayout): void {
    const palette = this.#palette;
    if (palette === undefined) return;
    this.#bounds = planBounds(layout);
    const textSharpness = this.#renderer.resolution * TEXT_SHARPNESS;
    const plan = new Container();
    plan.addChild(drawFloor(layout, this.#renderer, palette));
    for (const stage of STAGES) {
      const machine = drawMachine(stage, layout.stations[stage], textSharpness, palette);
      plan.addChild(machine.root);
      this.#machines.set(stage, machine.sprites);
    }
    plan.addChild(drawOffice(layout.foreman, textSharpness, palette));
    this.#world.addChildAt(plan, 0);
    this.#plan = plan;
  }

  /** Убирает холст и освобождает текстуры. */
  destroy(): void {
    if (!this.#mounted) return;
    this.#stage.destroy({ children: true, texture: true, textureSource: true });
    this.#renderer.destroy({ removeView: true });
    this.#mounted = false;
  }
}
