import type { FactoryLayout, Point, Scene } from "@cyberzavod/player";
import type { Locale } from "@/shared/i18n/locale.ts";

/** A point in floor container coordinates, CSS pixels from its top left corner. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A rectangle in container coordinates: the field free of the menu and HUD, where the plan fits.
 */
export interface Frame extends ScreenPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Factory graphics: how the floor, machines, workers and the part look. The model and the UI over
 * the floor know only this interface, so the graphics can be replaced entirely (pixels, shapes,
 * 3D) without touching the core, the model and the components.
 */
export interface FactoryGraphics {
  /** Embeds the canvas into the container and draws the static floor plan. */
  mount(container: HTMLElement, layout: FactoryLayout): Promise<void>;
  /**
   * Replaces the static plan: the floor, machines, office. Workers, the foreman and the part stay.
   * The next `resize` fits the new plan into the field: until then the scale stays from the old
   * plan.
   */
  setLayout(layout: FactoryLayout): void;
  /** Draws a scene frame. */
  render(scene: Scene): void;
  /**
   * Adapts to the container size (CSS pixels): the floor covers the whole container, the plan
   * fits into the `frame` field.
   */
  resize(width: number, height: number, frame: Frame): void;
  /** Converts a plan point to container coordinates, for HTML over the canvas. */
  toScreen(point: Point): ScreenPoint;
  /** Frees the canvas and GPU memory. */
  destroy(): void;
}

/**
 * Loads the factory graphics the site shows. Its code comes as a separate file and only in the
 * browser; to change the graphics, it is enough to return another FactoryGraphics implementation
 * here. Graphics labels are in the page language.
 * @param {Locale} locale Page language.
 * @returns {Promise<FactoryGraphics>} Graphics not yet embedded in the page.
 */
export async function loadFactoryGraphics(locale: Locale): Promise<FactoryGraphics> {
  const { PixelGraphics } = await import("./pixel/pixel-graphics.ts");

  return new PixelGraphics(locale);
}
