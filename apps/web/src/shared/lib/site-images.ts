import sharp from "sharp";
import { LOGO_LINES, LOGO_SHORT_LINES } from "@/shared/config/logo.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import tokensCss from "@/shared/ui/tokens.css?raw";
import { formatColor, parseColor, shade } from "./color.ts";
import { readCssTokens } from "./css-tokens.ts";
import { PLAQUE_PAPER_SHADE } from "./pixel-plaque.ts";
import { plaqueSvg, type PlaqueCanvas, type PlaquePaints } from "./plaque-svg.ts";

// Site icons and link previews: the menu logo plaque, made at build time.
// Colors come from the design tokens, labels from LOGO_LINES and LOGO_SHORT_LINES.

/** Side of the iOS home screen icon, in pixels. */
export const TOUCH_ICON_SIZE = 180;

/** Link preview size (`og:image`) expected by social networks and messengers, in pixels. */
export const PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const;

// The tab icon is vector; its side only sets the whole-number step of the plaque pixel.
const FAVICON_SIZE = 32;
const TOUCH_ICON_FILL = 0.8;
const PREVIEW_IMAGE_FILL = 0.6;
// The logo face matches the menu plaque (`--plaque-face` in Sidebar.module.css).
const LOGO_FACE_TOKEN = "--sun";
// The background is the factory floor: that is how the page around the logo looks.
const BACKGROUND_TOKEN = "--floor";
const INK_TOKEN = "--ink";

const tokens = readCssTokens(tokensCss);

function tokenColor(name: string): number {
  return parseColor(tokens.getPropertyValue(name));
}

function logoPaints(): PlaquePaints {
  const face = tokenColor(LOGO_FACE_TOKEN);

  return {
    ink: formatColor(tokenColor(INK_TOKEN)),
    paper: formatColor(face),
    paperShade: formatColor(shade(face, PLAQUE_PAPER_SHADE)),
  };
}

/**
 * Color of the browser interface around the site (`theme-color`): the factory floor.
 * @returns {string} Color of the form `#rrggbb`.
 */
export function siteThemeColor(): string {
  return formatColor(tokenColor(BACKGROUND_TOKEN));
}

/**
 * Tab icon: the short logo plaque ("CZ", «КЗ») on a transparent background.
 * @param {Locale} locale Language of the pages the icon is for.
 * @returns {string} SVG document.
 */
export function faviconSvg(locale: Locale): string {
  return plaqueSvg(LOGO_SHORT_LINES[locale], logoPaints(), {
    width: FAVICON_SIZE,
    height: FAVICON_SIZE,
    fill: 1,
  });
}

/**
 * Home screen icon: the short logo plaque on the factory floor. iOS does not accept transparency
 * or SVG, so the background is solid and the image is a PNG.
 * @param {Locale} locale Language of the pages the icon is for.
 * @returns {Promise<Uint8Array<ArrayBuffer>>} PNG image.
 */
export async function touchIconPng(locale: Locale): Promise<Uint8Array<ArrayBuffer>> {
  return pngOf(LOGO_SHORT_LINES[locale], {
    width: TOUCH_ICON_SIZE,
    height: TOUCH_ICON_SIZE,
    fill: TOUCH_ICON_FILL,
    background: siteThemeColor(),
  });
}

/**
 * Preview of a link to the site in social networks and messengers: the full logo plaque on the
 * factory floor.
 * @param {Locale} locale Language of the pages the preview is for.
 * @returns {Promise<Uint8Array<ArrayBuffer>>} PNG image.
 */
export async function previewImagePng(locale: Locale): Promise<Uint8Array<ArrayBuffer>> {
  return pngOf(LOGO_LINES[locale], {
    ...PREVIEW_IMAGE_SIZE,
    fill: PREVIEW_IMAGE_FILL,
    background: siteThemeColor(),
  });
}

async function pngOf(
  lines: readonly string[],
  canvas: PlaqueCanvas,
): Promise<Uint8Array<ArrayBuffer>> {
  const svg = plaqueSvg(lines, logoPaints(), canvas);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Uint8Array(png);
}
