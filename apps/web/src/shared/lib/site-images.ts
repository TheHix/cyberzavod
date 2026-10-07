import sharp from "sharp";
import { LOGO_LINES, LOGO_SHORT_LINES } from "@/shared/config/logo.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import tokensCss from "@/shared/ui/tokens.css?raw";
import { formatColor, parseColor, shade } from "./color.ts";
import { readCssTokens } from "./css-tokens.ts";
import { PLAQUE_PAPER_SHADE } from "./pixel-plaque.ts";
import { plaqueSvg, type PlaqueCanvas, type PlaquePaints } from "./plaque-svg.ts";

// Иконки сайта и превью ссылок — табличка логотипа из меню, собранная при сборке.
// Краски — из токенов оформления, надписи — из LOGO_LINES и LOGO_SHORT_LINES.

/** Сторона иконки для экрана «Домой» на iOS, в пикселях. */
export const TOUCH_ICON_SIZE = 180;

/** Размер превью ссылки (`og:image`) — тот, что ждут соцсети и мессенджеры, в пикселях. */
export const PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const;

// Иконка вкладки — векторная, её сторона задаёт только целый шаг пикселя таблички.
const FAVICON_SIZE = 32;
const TOUCH_ICON_FILL = 0.8;
const PREVIEW_IMAGE_FILL = 0.6;
// Лицо логотипа — как у таблички в меню (`--plaque-face` в Sidebar.module.css).
const LOGO_FACE_TOKEN = "--sun";
// Фон — пол цеха: так выглядит страница вокруг логотипа.
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
 * Цвет интерфейса браузера вокруг сайта (`theme-color`) — пол цеха.
 * @returns {string} Цвет вида `#rrggbb`.
 */
export function siteThemeColor(): string {
  return formatColor(tokenColor(BACKGROUND_TOKEN));
}

/**
 * Иконка вкладки: короткая табличка логотипа («CZ», «КЗ») на прозрачном фоне.
 * @param {Locale} locale Язык страниц, для которых иконка.
 * @returns {string} Документ SVG.
 */
export function faviconSvg(locale: Locale): string {
  return plaqueSvg(LOGO_SHORT_LINES[locale], logoPaints(), {
    width: FAVICON_SIZE,
    height: FAVICON_SIZE,
    fill: 1,
  });
}

/**
 * Иконка для экрана «Домой»: короткая табличка логотипа на полу цеха. iOS не берёт прозрачность
 * и SVG, поэтому фон сплошной, а картинка — PNG.
 * @param {Locale} locale Язык страниц, для которых иконка.
 * @returns {Promise<Uint8Array<ArrayBuffer>>} Картинка PNG.
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
 * Превью ссылки на сайт в соцсетях и мессенджерах: полная табличка логотипа на полу цеха.
 * @param {Locale} locale Язык страниц, для которых превью.
 * @returns {Promise<Uint8Array<ArrayBuffer>>} Картинка PNG.
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
