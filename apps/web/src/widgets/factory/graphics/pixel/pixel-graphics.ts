// The factory in pixel art on PixiJS. Sprites are baked into textures on embedding (floor,
// machines, office, plaques, workers, foreman and the part), the plan is redrawn only when the plan
// changes; in a frame, the ready sprites change the frame texture, position, mirroring, visibility
// and `tint`, without redrawing and without new objects. The world scale is whole in device pixels.

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
 * Pixel art factory graphics: sprites as strings, baked into textures. Plaque labels are in the
 * language set at creation.
 */
export class PixelGraphics implements FactoryGraphics {
  readonly #renderer: FactoryRenderer = createRenderer(isWebGLSupported());
  readonly #stage = new Container();
  readonly #world = new Container();
  // Workers, the foreman and the part are sorted by y: whoever is lower on the screen is closer to
  // the viewer. The part in hands goes by the carrier's y, half a pixel above or below them
  // (crateLayerOf).
  readonly #actors = new Container({ sortableChildren: true });
  // The static plan: floor, machines, office, plaques; it is replaced entirely when the plan
  // changes.
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
  // The page language does not change while the factory is open,
  // so the graphics stores it rather than receiving it in `setLayout`.
  readonly #locale: Locale;

  /**
   * Creates the graphics; plaque labels will be in this language.
   * @param {Locale} locale Page language.
   */
  constructor(locale: Locale) {
    this.#locale = locale;
  }

  /**
   * Embeds the canvas into the container and draws the static factory: floor, machines, foreman's
   * office, plaques.
   * @param {HTMLElement} container Element the canvas goes into.
   * @param {FactoryLayout} layout Floor plan.
   * @returns {Promise<void>} Resolves when the canvas is embedded.
   * @throws {Error} If the renderer could not be created or the plan could not be drawn.
   */
  async mount(container: HTMLElement, layout: FactoryLayout): Promise<void> {
    await this.#renderer.init({
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundAlpha: 0,
      // Pixels are not smoothed and do not shift by half a pixel: the sprite edge stays sharp.
      antialias: false,
      roundPixels: true,
      autoDensity: true,
      // No cap: otherwise the browser would stretch the canvas and blur it.
      resolution: window.devicePixelRatio,
      // The factory does not need Pixi's browser extensions (events, accessibility, DOM, filters):
      // the canvas is hidden from accessibility, and text and clicks live in HTML on top. If one is
      // needed, add it with an explicit `pixi.js/<module>` import.
      manageImports: false,
    });
    this.#mounted = true;
    const { canvas } = this.#renderer;

    canvas.setAttribute("aria-hidden", "true");
    canvas.style.imageRendering = "pixelated";
    container.append(canvas);

    // Inks come from the design tokens, as for the interface.
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
   * Replaces the static plan: floor, machines, office and plaques. Workers, the foreman and the
   * part stay. The next `resize` fits the new plan: the caller measures the field again anyway.
   * @param {FactoryLayout} layout New floor plan.
   */
  setLayout(layout: FactoryLayout): void {
    if (!this.#mounted) return;

    this.#plan?.destroy({ children: true, texture: true, textureSource: true });
    this.#machines.clear();
    this.#drawPlan(layout);
  }

  /**
   * Draws a scene frame.
   * @param {Scene} scene Floor frame.
   */
  render(scene: Scene): void {
    this.#placeWorkers(scene);

    if (this.#foreman !== undefined) placeForeman(this.#foreman, scene.foreman);
    if (this.#crate !== undefined) placeCrate(this.#crate, scene);

    this.#lightLamps(scene);
    this.#renderer.render(this.#stage);
  }

  /**
   * Fits the canvas to the container and fits the plan into the field with a whole multiplier.
   * @param {number} width Container width, CSS pixels.
   * @param {number} height Container height, CSS pixels.
   * @param {Frame} frame Field free of the menu and HUD, where the plan goes.
   */
  resize(width: number, height: number, frame: Frame): void {
    const bounds = this.#bounds;

    if (!this.#mounted || bounds === undefined) return;

    this.#renderer.resize(width, height);
    // The drawn factory is fitted, not the plan with empty margins: this way it is larger.
    const fit = fitPixelPlan(bounds, frame, this.#renderer.resolution);

    this.#scale = fit.scale;
    this.#offset = fit.offset;
    this.#world.scale.set(this.#scale / PIXELS_PER_UNIT);
    this.#world.position.set(this.#offset.x, this.#offset.y);
  }

  /**
   * Converts a plan point to container coordinates.
   * @param {Point} point Plan point.
   * @returns {ScreenPoint} Point in CSS pixels from the top left corner of the container.
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

  // The plan is drawn under the workers, the foreman and the part: it is first in the world.
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
   * Removes the canvas and frees all baked textures, of the plan and the actors, including frames
   * not on sprites now.
   */
  destroy(): void {
    if (!this.#mounted) return;

    this.#plan?.destroy({ children: true, texture: true, textureSource: true });
    // Actor textures belong not to the sprites but to `#actorTextures`: each sprite holds only one
    // frame, the rest are freed separately.
    this.#stage.destroy({ children: true });
    if (this.#actorTextures !== undefined) destroyActorTextures(this.#actorTextures);

    this.#renderer.destroy({ removeView: true });
    this.#mounted = false;
  }
}
