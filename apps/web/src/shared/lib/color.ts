// Цвета токенов оформления числами 0xRRGGBB: так их берёт графика цеха (PixiJS) и так их
// затемняют и осветляют для объёма, а картинки сайта (иконки, превью ссылок) — снова строкой CSS.

const HEX_COLOR = /^#([\da-f]{6})$/i;
// Сборка сжимает CSS: `#ffffff` в токенах доходит до браузера как `#fff`.
const SHORT_HEX_COLOR = /^#([\da-f]{3})$/i;
const HEX_BASE = 16;

/**
 * Переводит цвет CSS вида `#rrggbb` или `#rgb` в число 0xRRGGBB.
 * @param {string} value Цвет из токена оформления.
 * @returns {number} Цвет 0xRRGGBB.
 * @throws {Error} Если это не цвет вида `#rrggbb` или `#rgb`.
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
 * Записывает цвет 0xRRGGBB строкой CSS — для картинок, которые собираются из токенов.
 * @param {number} color Цвет 0xRRGGBB.
 * @returns {string} Цвет вида `#rrggbb`.
 */
export function formatColor(color: number): string {
  return `#${color.toString(HEX_BASE).padStart(COLOR_DIGITS, "0")}`;
}

const CHANNEL = 0xff;

/**
 * Делает цвет темнее или светлее — для объёма: тёмная грань станка, светлый блик.
 * @param {number} color Цвет 0xRRGGBB.
 * @param {number} amount От −1 (чёрный) через 0 (без изменений) до 1 (белый).
 * @returns {number} Новый цвет 0xRRGGBB.
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
