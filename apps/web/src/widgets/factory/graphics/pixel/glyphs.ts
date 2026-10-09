// Factory plaques: a plaque sprite with a label in the shared pixel font, painted with factory ink.

import { plaqueArt } from "@/shared/lib/pixel-plaque.ts";
import { artSize, paintArt, paletteInks, type ArtSize, type PixelImage } from "./art.ts";
import type { Palette } from "./palette.ts";

/**
 * Size of a plaque with a label: paper, margins, outline and a shadow downward.
 * @param {string} text Label.
 * @returns {ArtSize} Width and height in sprite pixels.
 * @throws {Error} If the label has a letter without a glyph.
 */
export function plaqueSize(text: string): ArtSize {
  return artSize(plaqueArt([text]));
}

/**
 * Draws a plaque with an uppercase label: paper, a 1-pixel outline, a 1-pixel shadow downward,
 * letters 1 pixel apart.
 * @param {string} text Label; lowercase letters become uppercase.
 * @param {Palette} palette Factory inks.
 * @returns {PixelImage} Plaque image.
 * @throws {Error} If the label has a letter without a glyph.
 */
export function plaqueImage(text: string, palette: Palette): PixelImage {
  return paintArt(plaqueArt([text]), paletteInks(palette));
}
