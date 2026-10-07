import { describe, expect, it } from "vitest";
import { plaqueArt } from "./pixel-plaque.ts";
import { plaqueSvg, type PlaqueCanvas, type PlaquePaints } from "./plaque-svg.ts";

function paints(): PlaquePaints {
  return { ink: "#000001", paper: "#000002", paperShade: "#000003" };
}

function canvas(overrides: Partial<PlaqueCanvas> = {}): PlaqueCanvas {
  return { width: 100, height: 100, fill: 1, ...overrides };
}

describe("plaqueSvg", () => {
  it("берёт размер картинки из холста", () => {
    const svg = plaqueSvg(["CZ"], paints(), canvas({ width: 120, height: 60 }));

    expect(svg).toContain('width="120" height="60" viewBox="0 0 120 60"');
  });

  it("увеличивает табличку в целое число раз и ставит её посередине", () => {
    const art = plaqueArt(["CZ"]);
    const scale = 3;
    const size = (art[0]?.length ?? 0) * scale + 1;
    const top = Math.floor((size - art.length * scale) / 2);

    const svg = plaqueSvg(["CZ"], paints(), canvas({ width: size, height: size }));

    expect(svg).toContain(`translate(0 ${String(top)}) scale(${String(scale)})`);
  });

  it("красит табличку переданными красками", () => {
    const svg = plaqueSvg(["CZ"], paints(), canvas());

    expect(svg).toContain('fill="#000001"');
    expect(svg).toContain('fill="#000002"');
    expect(svg).toContain('fill="#000003"');
  });

  it("кладёт под табличку фон холста", () => {
    const svg = plaqueSvg(["CZ"], paints(), canvas({ background: "#7d8fe3" }));

    expect(svg).toContain('<rect width="100" height="100" fill="#7d8fe3"/>');
  });

  it("без фона оставляет холст прозрачным", () => {
    const svg = plaqueSvg(["CZ"], paints(), canvas());

    expect(svg).not.toContain('<rect width="100"');
  });
});
