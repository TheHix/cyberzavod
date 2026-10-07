// Цех в пиксель-арте на PixiJS. Рисунки запекаются в текстуры при встраивании (пол, станки,
// кабинет, таблички, рабочие, мастер и деталь), план перерисовывается только при смене плана;
// в кадре у готовых спрайтов меняются текстура кадра, место, зеркало, видимость и `tint` —
// без перерисовки и без новых объектов. Масштаб мира — целый в пикселях устройства.

import { STAGES, type Stage } from "@cyberzavod/core";
import { type FactoryLayout, type Point, type Scene } from "@cyberzavod/player";
import { Container, isWebGLSupported } from "pixi.js";
import type { Locale } from "@/shared/i18n/locale.ts";
import type { FactoryGraphics, Frame, ScreenPoint } from "../factory-graphics.ts";
import {
  bakeActorTextures,
  createCrate,
  createForeman,
  createWorker,
  destroyActorTextures,
  placeCrate,
  placeForeman,
  placeWorker,
  type ActorSprites,
  type ActorTextures,
  type CrateSprites,
} from "./actors.ts";
import { fitPixelPlan, planBounds, type PlanBounds } from "./bounds.ts";
import { drawFloor } from "./floor.ts";
import { lampLit, machineWorkOf } from "./frames.ts";
import { drawMachine, showMachineWork, type MachineSprites } from "./machines.ts";
import { drawOffice } from "./office.ts";
import { readPalette, type Palette } from "./palette.ts";
import { drawPlaques } from "./plaques.ts";
import { createRenderer, type FactoryRenderer } from "./renderer.ts";
import { PIXELS_PER_UNIT } from "./units.ts";

/**
 * Графика цеха в пиксель-арте: рисунки строками, запечённые в текстуры. Надписи табличек —
 * на языке, который задан при создании.
 */
export class PixelGraphics implements FactoryGraphics {
  readonly #renderer: FactoryRenderer = createRenderer(isWebGLSupported());
  readonly #stage = new Container();
  readonly #world = new Container();
  // Рабочие, мастер и деталь сортируются по y: кто ниже на экране, тот ближе к зрителю. Деталь в
  // руках — от y несущего, на полпикселя над ним или под ним (crateLayerOf).
  readonly #actors = new Container({ sortableChildren: true });
  // Неподвижный план — пол, станки, кабинет, таблички: при смене плана он заменяется целиком.
  #plan: Container | undefined;
  #palette: Palette | undefined;
  readonly #workers = new Map<Stage, ActorSprites>();
  readonly #machines = new Map<Stage, MachineSprites>();
  #foreman: ActorSprites | undefined;
  #crate: CrateSprites | undefined;
  #actorTextures: ActorTextures | undefined;
  #bounds: PlanBounds | undefined;
  #scale = 1;
  #offset: ScreenPoint = { x: 0, y: 0 };
  #mounted = false;
  // Язык страницы не меняется, пока открыт цех,
  // поэтому графика хранит его, а не получает в `setLayout`.
  readonly #locale: Locale;

  /**
   * Создаёт графику; надписи табличек будут на этом языке.
   * @param {Locale} locale Язык страницы.
   */
  constructor(locale: Locale) {
    this.#locale = locale;
  }

  /**
   * Встраивает холст в контейнер и рисует неподвижный цех: пол, станки, кабинет мастера, таблички.
   * @param {HTMLElement} container Элемент, в который встаёт холст.
   * @param {FactoryLayout} layout План цеха.
   * @returns {Promise<void>} Готово, когда холст встроен.
   * @throws {Error} Если не удалось создать рендерер или нарисовать план.
   */
  async mount(container: HTMLElement, layout: FactoryLayout): Promise<void> {
    await this.#renderer.init({
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundAlpha: 0,
      // Пиксели не сглаживаются и не уходят на полпикселя: край спрайта остаётся резким.
      antialias: false,
      roundPixels: true,
      autoDensity: true,
      // Без потолка: иначе браузер растянет холст и замылит его.
      resolution: window.devicePixelRatio,
      // Расширения Pixi для браузера (события, доступность, DOM, фильтры) цеху не нужны:
      // холст скрыт от доступности, а текст и клики живут в HTML поверх. Понадобится какое-то —
      // подключать явным импортом `pixi.js/<модуль>`.
      manageImports: false,
    });
    this.#mounted = true;
    const { canvas } = this.#renderer;

    canvas.setAttribute("aria-hidden", "true");
    canvas.style.imageRendering = "pixelated";
    container.append(canvas);

    // Краски — из токенов оформления, как у интерфейса.
    const palette = readPalette(getComputedStyle(container));

    this.#palette = palette;
    this.#drawPlan(layout);
    this.#world.addChild(this.#actors);
    this.#addActors(palette);
    this.#stage.addChild(this.#world);
    const { clientWidth: width, clientHeight: height } = container;

    this.resize(width, height, { x: 0, y: 0, width, height });
  }

  /**
   * Заменяет неподвижный план — пол, станки, кабинет и таблички. Рабочие, мастер и деталь
   * остаются. Вписывает новый план следующий `resize`: вызывающий всё равно меряет поле заново.
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
    this.#placeWorkers(scene);

    if (this.#foreman !== undefined) placeForeman(this.#foreman, scene.foreman);
    if (this.#crate !== undefined) placeCrate(this.#crate, scene);

    this.#lightLamps(scene);
    this.#renderer.render(this.#stage);
  }

  /**
   * Подстраивает холст под контейнер и вписывает план в поле целым множителем.
   * @param {number} width Ширина контейнера, CSS-пиксели.
   * @param {number} height Высота контейнера, CSS-пиксели.
   * @param {Frame} frame Поле, свободное от меню и HUD, — туда встаёт план.
   */
  resize(width: number, height: number, frame: Frame): void {
    const bounds = this.#bounds;

    if (!this.#mounted || bounds === undefined) return;

    this.#renderer.resize(width, height);
    // Вписывается нарисованный цех, а не план с пустыми краями: так он крупнее.
    const fit = fitPixelPlan(bounds, frame, this.#renderer.resolution);

    this.#scale = fit.scale;
    this.#offset = fit.offset;
    this.#world.scale.set(this.#scale / PIXELS_PER_UNIT);
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

  #placeWorkers(scene: Scene): void {
    for (const worker of scene.workers) {
      const sprites = this.#workers.get(worker.station);

      if (sprites !== undefined) placeWorker(sprites, worker);

      const machine = this.#machines.get(worker.station);

      if (machine !== undefined) showMachineWork(machine, machineWorkOf(worker));
    }
  }

  #lightLamps(scene: Scene): void {
    const isBlinkLit = lampLit(scene.time);

    for (const [stage, machine] of this.#machines) {
      const isWorking = scene.part.holder === stage && !scene.part.carried && !scene.finished;

      machine.lampOn.visible = isWorking && isBlinkLit;
    }
  }

  #addActors(palette: Palette): void {
    const textures = bakeActorTextures(palette);

    this.#actorTextures = textures;

    for (const stage of STAGES) {
      const worker = createWorker(stage, textures);

      this.#actors.addChild(worker.root);
      this.#workers.set(stage, worker);
    }

    this.#foreman = createForeman(textures);
    this.#actors.addChild(this.#foreman.root);
    this.#crate = createCrate(textures, palette);
    this.#actors.addChild(this.#crate.root);
  }

  // План рисуется под рабочими, мастером и деталью: он первый в мире.
  #drawPlan(layout: FactoryLayout): void {
    const palette = this.#palette;

    if (palette === undefined) return;

    this.#bounds = planBounds(layout, this.#locale);
    const plan = new Container();

    plan.addChild(drawFloor(layout, palette));

    for (const stage of STAGES) {
      const machine = drawMachine(stage, layout.stations[stage], palette);

      plan.addChild(machine.root);
      this.#machines.set(stage, machine.sprites);
    }

    plan.addChild(drawOffice(layout.foreman, palette));
    plan.addChild(drawPlaques(layout, palette, this.#locale));
    this.#world.addChildAt(plan, 0);
    this.#plan = plan;
  }

  /**
   * Убирает холст и освобождает все запечённые текстуры: плана и действующих лиц, в том числе
   * кадры, которых сейчас нет на спрайтах.
   */
  destroy(): void {
    if (!this.#mounted) return;

    this.#plan?.destroy({ children: true, texture: true, textureSource: true });
    // Текстуры действующих лиц принадлежат не спрайтам, а `#actorTextures`: на спрайтах висит
    // лишь по одному кадру, остальные освобождаются отдельно.
    this.#stage.destroy({ children: true });
    if (this.#actorTextures !== undefined) destroyActorTextures(this.#actorTextures);

    this.#renderer.destroy({ removeView: true });
    this.#mounted = false;
  }
}
