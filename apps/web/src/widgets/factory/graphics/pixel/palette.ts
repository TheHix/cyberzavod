// Factory inks. The only source is the design tokens (shared/ui/tokens.css): the factory reads them
// on embedding, so the floor matches the page background, and the outline matches the panel
// outline.

import type { Stage } from "@cyberzavod/core";
import type { PartStatus } from "@cyberzavod/player";
import { parseColor } from "@/shared/lib/color.ts";
import type { TokenSource } from "@/shared/lib/css-tokens.ts";

/** Factory inks as 0xRRGGBB numbers, the form PixiJS takes them in. */
export interface Palette {
  readonly ink: number;
  readonly inkSoft: number;
  readonly paper: number;
  /** Pure white: glass, highlights and the glow base that `tint` colors. */
  readonly white: number;
  /** Color of the machine and its worker's uniform: each stage has its own. */
  readonly stations: Readonly<Record<Stage, number>>;
  readonly floor: {
    readonly tile: number;
    readonly tileAlt: number;
    readonly grout: number;
    readonly lane: number;
    readonly mark: number;
    readonly pad: number;
  };
  /** Foreman uniform color: their own, matching no stage color. */
  readonly foreman: number;
  /** Foreman helmet: almost white, so they stand out among workers in yellow helmets. */
  readonly foremanHelmet: number;
  readonly skin: number;
  readonly helmet: number;
  readonly crate: { readonly wood: number; readonly plank: number };
  readonly screen: number;
  readonly screenGlass: number;
  readonly belt: number;
  /** Machine lamp: dim when off, lit when working. */
  readonly lamp: { readonly off: number; readonly on: number };
  /** Glow under the part by state; a part in work has no glow. */
  readonly status: Readonly<Record<PartStatus, number | null>>;
}

/**
 * Collects factory inks from the design tokens.
 * @param {TokenSource} tokens Styles of an element where the tokens are visible
 *   (`getComputedStyle`).
 * @returns {Palette} Factory inks.
 * @throws {Error} If some token is missing or is not a color of the form `#rrggbb` or `#rgb`.
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
      planning: color("--sky"),
      implementation: color("--tangerine"),
      verification: mint,
      review: color("--grape"),
      record: color("--bubblegum"),
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
