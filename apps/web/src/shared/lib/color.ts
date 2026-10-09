// Design token colors as 0xRRGGBB numbers: that is how the factory floor graphics (PixiJS) take
// them and how they are darkened and lightened for depth; site images (icons, link previews) take
// them back as CSS strings.

const HEX_COLOR = /^#([\da-f]{6})$/i;
// The build minifies CSS: `#ffffff` in the tokens reaches the browser as `#fff`.
const SHORT_HEX_COLOR = /^#([\da-f]{3})$/i;
const HEX_BASE = 16;

/**
 * Converts a CSS color of the form `#rrggbb` or `#rgb` to a 0xRRGGBB number.
 * @param {string} value Color from a design token.
 * @returns {number} 0xRRGGBB color.
 * @throws {Error} If it is not a color of the form `#rrggbb` or `#rgb`.
 */
export function parseColor(value: string): number {
  const color = value.trim();
  const short = SHORT_HEX_COLOR.exec(color)?.[1];
  const hex = short === undefined ? HEX_COLOR.exec(color)?.[1] : doubledDigits(short);

  if (hex === undefined) {
    throw new Error(`цвет токена должен быть вида #rrggbb или #rgb, а не «${value}»`);
  }

  return Number.parseInt(hex, HEX_BASE);
}

function doubledDigits(hex: string): string {
  return [...hex].map((digit) => digit + digit).join("");
}

const COLOR_DIGITS = 6;

/**
 * Writes a 0xRRGGBB color as a CSS string, for images built from the tokens.
 * @param {number} color 0xRRGGBB color.
 * @returns {string} Color of the form `#rrggbb`.
 */
export function formatColor(color: number): string {
  return `#${color.toString(HEX_BASE).padStart(COLOR_DIGITS, "0")}`;
}

const CHANNEL = 0xff;

/**
 * Makes a color darker or lighter, for depth: a machine's dark side, a light highlight.
 * @param {number} color 0xRRGGBB color.
 * @param {number} amount From −1 (black) through 0 (unchanged) to 1 (white).
 * @returns {number} New 0xRRGGBB color.
 */
export function shade(color: number, amount: number): number {
  const target = amount < 0 ? 0 : CHANNEL;
  const weight = Math.min(1, Math.abs(amount));
  const mix = (shift: number) => {
    const channel = (color >> shift) & CHANNEL;

    return Math.round(channel + (target - channel) * weight) << shift;
  };

  return mix(16) | mix(8) | mix(0);
}
