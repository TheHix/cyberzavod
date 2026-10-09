import { describe, expect, it } from "vitest";
import { LOCALES } from "@/shared/i18n/locale.ts";
import { plaqueArt } from "@/shared/lib/pixel-plaque.ts";
import { LOGO_LINES, LOGO_SHORT_LINES } from "./logo.ts";

// Menu width in art pixels: (7rem − 2 × 0.6rem − 2 × 3px outline) / 3px plaque pixel, rounded
// down. Changes together with `--sidebar-width` and the menu padding in Sidebar.module.css.
const LOGO_MAX_PIXELS = 28;

describe("LOGO_LINES", () => {
  it.each(LOCALES)("полная табличка (%s) не шире меню", (locale) => {
    const art = plaqueArt(LOGO_LINES[locale]);

    expect(art[0]?.length).toBeLessThanOrEqual(LOGO_MAX_PIXELS);
  });
});

describe("LOGO_SHORT_LINES", () => {
  it.each(LOCALES)("короткая табличка (%s) уже полной", (locale) => {
    const full = plaqueArt(LOGO_LINES[locale]);

    const short = plaqueArt(LOGO_SHORT_LINES[locale]);

    expect(short[0]?.length).toBeLessThan(full[0]?.length ?? 0);
  });
});
