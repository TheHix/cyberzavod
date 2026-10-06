// Краски цеха. Единственный источник — токены оформления (shared/ui/tokens.css): цех читает
// их при встраивании, поэтому пол совпадает с фоном страницы, а контур — с контуром панелей.

import type { PartStatus, Stage } from "@cyberzavod/core";

/** Краски цеха числами 0xRRGGBB — в таком виде их берёт PixiJS. */
export interface Palette {
  readonly ink: number;
  readonly inkSoft: number;
  readonly paper: number;
  /** Чистый белый: стекло, блики и основа свечения, которую красит `tint`. */
  readonly white: number;
  /** Цвет станка и формы его рабочего: у каждого этапа свой. */
  readonly stations: Readonly<Record<Stage, number>>;
  readonly floor: {
    readonly tile: number;
    readonly tileAlt: number;
    readonly grout: number;
    readonly lane: number;
    readonly mark: number;
    readonly pad: number;
  };
  /** Цвет формы мастера: свой, не совпадающий с цветом ни одного этапа. */
  readonly foreman: number;
  /** Каска мастера: почти белая, его видно среди рабочих в жёлтых касках. */
  readonly foremanHelmet: number;
  readonly skin: number;
  readonly helmet: number;
  readonly crate: { readonly wood: number; readonly plank: number };
  readonly screen: number;
  readonly screenGlass: number;
  readonly belt: number;
  /** Лампа станка: выключена — тусклая, работает — светится. */
  readonly lamp: { readonly off: number; readonly on: number };
  /** Свечение под деталью по состоянию; у детали в работе свечения нет. */
  readonly status: Readonly<Record<PartStatus, number | null>>;
}

/** Откуда читаются токены — достаточно `getPropertyValue`, как у `CSSStyleDeclaration`. */
export interface TokenSource {
  getPropertyValue(name: string): string;
}

const HEX_COLOR = /^#([\da-f]{6})$/i;
// Сборка сжимает CSS: `#ffffff` в токенах доходит до браузера как `#fff`.
const SHORT_HEX_COLOR = /^#([\da-f]{3})$/i;
const HEX_BASE = 16;

/**
 * Переводит цвет CSS вида `#rrggbb` или `#rgb` в число для PixiJS.
 * @param {string} value Цвет из токена.
 * @returns {number} Цвет 0xRRGGBB.
 * @throws {Error} Если это не цвет вида `#rrggbb` или `#rgb`.
 */
export function parseColor(value: string): number {
  const color = value.trim();
  const short = SHORT_HEX_COLOR.exec(color)?.[1];
  const hex = short === undefined ? HEX_COLOR.exec(color)?.[1] : doubledDigits(short);
  if (hex === undefined) {
    throw new Error(`краска цеха должна быть вида #rrggbb или #rgb, а не «${value}»`);
  }
  return Number.parseInt(hex, HEX_BASE);
}

function doubledDigits(hex: string): string {
  return [...hex].map((digit) => digit + digit).join("");
}

/**
 * Собирает краски цеха из токенов оформления.
 * @param {TokenSource} tokens Стили элемента, где видны токены (`getComputedStyle`).
 * @returns {Palette} Краски цеха.
 * @throws {Error} Если какого-то токена нет или он не цвет вида `#rrggbb` или `#rgb`.
 */
export function readPalette(tokens: TokenSource): Palette {
  const color = (name: string) => parseColor(tokens.getPropertyValue(name));
  const mint = color("--mint");
  const inkSoft = color("--ink-soft");
  return {
    ink: color("--ink"),
    inkSoft,
    paper: color("--paper"),
    white: color("--white"),
    stations: {
      spec: color("--sky"),
      code: color("--tangerine"),
      test: mint,
      review: color("--grape"),
      ship: color("--bubblegum"),
    },
    floor: {
      tile: color("--floor"),
      tileAlt: color("--floor-tile-alt"),
      grout: color("--floor-grout"),
      lane: color("--floor-lane"),
      mark: color("--sun"),
      pad: color("--floor-pad"),
    },
    foreman: color("--foreman"),
    foremanHelmet: color("--foreman-helmet"),
    skin: color("--skin"),
    helmet: color("--sun"),
    crate: { wood: color("--crate"), plank: color("--crate-plank") },
    screen: color("--screen"),
    screenGlass: color("--screen-glass"),
    belt: color("--belt"),
    lamp: { off: inkSoft, on: color("--lamp-on") },
    status: { ok: null, defect: color("--danger"), done: mint, scrap: inkSoft },
  };
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
