// Таблички цеха: рисунок таблички с надписью из общего пиксельного шрифта, покрашенный краской цеха.

import { plaqueArt } from "@/shared/lib/pixel-plaque.ts";
import { artSize, paintArt, paletteInks, type ArtSize, type PixelImage } from "./art.ts";
import type { Palette } from "./palette.ts";

/**
 * Размер таблички с надписью: бумага, поля, контур и тень вниз.
 * @param {string} text Надпись.
 * @returns {ArtSize} Ширина и высота в пикселях рисунка.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueSize(text: string): ArtSize {
  return artSize(plaqueArt([text]));
}

/**
 * Рисует табличку с надписью заглавными: бумага, контур в 1 пиксель, тень вниз в 1 пиксель,
 * буквы через 1 пиксель.
 * @param {string} text Надпись; строчные буквы становятся заглавными.
 * @param {Palette} palette Краски цеха.
 * @returns {PixelImage} Картинка таблички.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueImage(text: string, palette: Palette): PixelImage {
  return paintArt(plaqueArt([text]), paletteInks(palette));
}
