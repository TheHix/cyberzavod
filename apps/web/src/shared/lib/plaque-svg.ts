import { plaqueArt, plaqueRuns, type PlaqueInk, type PlaqueRun } from "./pixel-plaque.ts";

// A plaque as an SVG string, for images made at build time without Solid or the DOM:
// tab icons and link previews. In the menu the same plaque is drawn by the PixelPlaque component.

/** Plaque colors as CSS colors. */
export type PlaquePaints = Readonly<Record<PlaqueInk, string>>;

/** Image canvas with the plaque in its middle. */
export interface PlaqueCanvas {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** The largest share of the canvas width and height the plaque takes: from 0 to 1. */
  readonly fill: number;
  /** Background under the plaque; without it the canvas is transparent. */
  readonly background?: string;
}

function backgroundRect(canvas: PlaqueCanvas): string {
  if (canvas.background === undefined) return "";

  return `<rect width="${String(canvas.width)}" height="${String(canvas.height)}" fill="${canvas.background}"/>`;
}

function runRect(run: PlaqueRun, paint: string): string {
  return `<rect x="${String(run.x)}" y="${String(run.y)}" width="${String(run.width)}" height="1" fill="${paint}"/>`;
}

/**
 * Draws a plaque with a label in the middle of the canvas. A plaque pixel is a whole number of
 * image pixels, so edges stay crisp even after conversion to PNG.
 * @param {readonly string[]} lines Label lines; lowercase letters become uppercase.
 * @param {PlaquePaints} paints Plaque colors.
 * @param {PlaqueCanvas} canvas Image canvas.
 * @returns {string} SVG document.
 * @throws {Error} If the label has a letter without a glyph.
 */
export function plaqueSvg(
  lines: readonly string[],
  paints: PlaquePaints,
  canvas: PlaqueCanvas,
): string {
  const art = plaqueArt(lines);
  const artWidth = art[0]?.length ?? 0;
  const artHeight = art.length;
  const fitScale = Math.min(
    (canvas.width * canvas.fill) / artWidth,
    (canvas.height * canvas.fill) / artHeight,
  );
  const scale = Math.max(1, Math.floor(fitScale));
  const left = Math.floor((canvas.width - artWidth * scale) / 2);
  const top = Math.floor((canvas.height - artHeight * scale) / 2);
  const background = backgroundRect(canvas);
  const runs = plaqueRuns(art)
    .map((run) => runRect(run, paints[run.ink]))
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(canvas.width)}" height="${String(canvas.height)}" ` +
    `viewBox="0 0 ${String(canvas.width)} ${String(canvas.height)}" shape-rendering="crispEdges">` +
    background +
    `<g transform="translate(${String(left)} ${String(top)}) scale(${String(scale)})">${runs}</g>` +
    `</svg>`
  );
}
