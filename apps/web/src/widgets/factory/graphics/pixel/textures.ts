import { CanvasSource, Texture } from "pixi.js";
import type { PixelImage } from "./art.ts";

/**
 * Превращает картинку в текстуру PixiJS с выборкой ближайшего пикселя: при любом целом
 * масштабе края остаются резкими. Единственное место графики, где создаётся DOM-холст.
 * @param {PixelImage} image Готовая картинка.
 * @returns {Texture} Текстура; её уничтожает тот, кто владеет спрайтом.
 * @throws {Error} Если у холста нет 2d-контекста.
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
