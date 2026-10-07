import { plaqueArt, plaqueRuns, type PlaqueInk } from "./pixel-plaque.ts";

// Табличка строкой SVG — для картинок, которые собираются при сборке без Solid и DOM:
// иконки вкладки и превью ссылок. В меню ту же табличку рисует компонент PixelPlaque.

/** Краски таблички цветами CSS. */
export type PlaquePaints = Readonly<Record<PlaqueInk, string>>;

/** Холст картинки, посередине которого стоит табличка. */
export interface PlaqueCanvas {
  /** Ширина картинки в пикселях. */
  readonly width: number;
  /** Высота картинки в пикселях. */
  readonly height: number;
  /** Какую долю ширины и высоты холста табличка занимает самое большее: от 0 до 1. */
  readonly fill: number;
  /** Фон под табличкой; без него холст прозрачный. */
  readonly background?: string;
}

/**
 * Рисует табличку с надписью посередине холста. Пиксель таблички — целое число пикселей
 * картинки, чтобы края оставались чёткими и после перевода в PNG.
 * @param {readonly string[]} lines Строки надписи; строчные буквы становятся заглавными.
 * @param {PlaquePaints} paints Краски таблички.
 * @param {PlaqueCanvas} canvas Холст картинки.
 * @returns {string} Документ SVG.
 * @throws {Error} Если в надписи есть буква без глифа.
 */
export function plaqueSvg(
  lines: readonly string[],
  paints: PlaquePaints,
  canvas: PlaqueCanvas,
): string {
  const art = plaqueArt(lines);
  const artWidth = art[0]?.length ?? 0;
  const artHeight = art.length;
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((canvas.width * canvas.fill) / artWidth, (canvas.height * canvas.fill) / artHeight),
    ),
  );
  const left = Math.floor((canvas.width - artWidth * scale) / 2);
  const top = Math.floor((canvas.height - artHeight * scale) / 2);
  const background =
    canvas.background === undefined
      ? ""
      : `<rect width="${String(canvas.width)}" height="${String(canvas.height)}" fill="${canvas.background}"/>`;
  const runs = plaqueRuns(art)
    .map(
      (run) =>
        `<rect x="${String(run.x)}" y="${String(run.y)}" width="${String(run.width)}" height="1" fill="${paints[run.ink]}"/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(canvas.width)}" height="${String(canvas.height)}" ` +
    `viewBox="0 0 ${String(canvas.width)} ${String(canvas.height)}" shape-rendering="crispEdges">` +
    background +
    `<g transform="translate(${String(left)} ${String(top)}) scale(${String(scale)})">${runs}</g>` +
    `</svg>`
  );
}
