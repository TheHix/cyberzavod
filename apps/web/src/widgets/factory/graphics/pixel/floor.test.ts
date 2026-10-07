import { describe, expect, it } from "vitest";
import { laneTileImage, floorTileImage, LANE_HALF_WIDTH, padImage } from "./floor.ts";
import type { PixelImage } from "./art.ts";
import { testPalette } from "./test-palette.ts";

function pixelAt(image: PixelImage, column: number, row: number): { color: number; alpha: number } {
  const at = (row * image.width + column) * 4;
  const [red = 0, green = 0, blue = 0, alpha = 0] = image.pixels.slice(at, at + 4);

  return { color: (red << 16) | (green << 8) | blue, alpha };
}

describe("floorTileImage", () => {
  it("рисует плитку 32×32 из четырёх клеток", () => {
    const { floor } = testPalette();

    const image = floorTileImage(floor);

    expect([image.width, image.height]).toEqual([32, 32]);
  });

  it("красит шов, а клетки шахматкой", () => {
    const { floor } = testPalette();

    const image = floorTileImage(floor);

    expect(pixelAt(image, 0, 5).color).toBe(floor.grout);
    expect(pixelAt(image, 5, 0).color).toBe(floor.grout);
    expect(pixelAt(image, 5, 5).color).toBe(floor.tile);
    expect(pixelAt(image, 21, 5).color).toBe(floor.tileAlt);
    expect(pixelAt(image, 5, 21).color).toBe(floor.tileAlt);
    expect(pixelAt(image, 21, 21).color).toBe(floor.tile);
  });
});

describe("laneTileImage", () => {
  it("делает горизонтальную полосу шириной в весь проход", () => {
    const { floor } = testPalette();

    const image = laneTileImage("horizontal", floor);

    expect(image.height).toBe(LANE_HALF_WIDTH * 2);
  });

  it("делает вертикальную полосу, повернув горизонтальную", () => {
    const { floor } = testPalette();

    const horizontal = laneTileImage("horizontal", floor);
    const vertical = laneTileImage("vertical", floor);

    expect([vertical.width, vertical.height]).toEqual([horizontal.height, horizontal.width]);
  });

  it("красит кромки, заливку и штрих по оси", () => {
    const { floor } = testPalette();

    const image = laneTileImage("horizontal", floor);

    const middle = LANE_HALF_WIDTH;

    expect(pixelAt(image, 3, 0).color).toBe(floor.grout);
    expect(pixelAt(image, 3, image.height - 1).color).toBe(floor.grout);
    expect(pixelAt(image, 3, 3).color).toBe(floor.lane);
    expect(pixelAt(image, 3, middle).color).toBe(floor.mark);
    expect(pixelAt(image, 12, middle).color).toBe(floor.lane);
  });

  it("кладёт штрих вертикальной полосы по её оси", () => {
    const { floor } = testPalette();

    const image = laneTileImage("vertical", floor);

    expect(pixelAt(image, LANE_HALF_WIDTH, 3).color).toBe(floor.mark);
    expect(pixelAt(image, 0, 3).color).toBe(floor.grout);
  });
});

describe("padImage", () => {
  it("рисует площадку заданного размера", () => {
    const image = padImage(50, 40, testPalette());

    expect([image.width, image.height]).toEqual([50, 40]);
  });

  it("обводит рамкой в 1 пиксель и заливает краской площадки", () => {
    const palette = testPalette();

    const image = padImage(50, 40, palette);

    expect(pixelAt(image, 25, 20).color).toBe(palette.floor.pad);
    expect(pixelAt(image, 25, 0).color).not.toBe(palette.floor.pad);
    expect(pixelAt(image, 0, 20).color).not.toBe(palette.floor.pad);
  });

  it("срезает углы: угловой пиксель прозрачен", () => {
    const image = padImage(50, 40, testPalette());

    const corners = [
      pixelAt(image, 0, 0),
      pixelAt(image, 49, 0),
      pixelAt(image, 0, 39),
      pixelAt(image, 49, 39),
    ];

    expect(corners.map(({ alpha }) => alpha)).toEqual([0, 0, 0, 0]);
  });
});
