import { CanvasSource, Texture } from "pixi.js";
import type { PixelImage } from "./art.ts";

/**
 * Turns an image into a PixiJS texture with nearest-pixel sampling: at any whole scale the edges
 * stay sharp. The only place in the graphics where a DOM canvas is created.
 * @param {PixelImage} image Ready image.
 * @returns {Texture} Texture; whoever owns the sprite destroys it.
 * @throws {Error} If the canvas has no 2d context.
 */
export function textureOf(image: PixelImage): Texture {
  const canvas = document.createElement("canvas");

  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");

  if (context === null) throw new Error("у холста для текстуры нет 2d-контекста");

  context.putImageData(new ImageData(image.pixels, image.width, image.height), 0, 0);

  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: "nearest" }) });
}
