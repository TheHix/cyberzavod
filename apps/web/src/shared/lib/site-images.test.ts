import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  PREVIEW_IMAGE_SIZE,
  TOUCH_ICON_SIZE,
  faviconSvg,
  previewImagePng,
  siteThemeColor,
  touchIconPng,
} from "./site-images.ts";

describe("siteThemeColor", () => {
  it("берёт цвет пола цеха из токенов", () => {
    const color = siteThemeColor();

    expect(color).toMatch(/^#[\da-f]{6}$/);
  });
});

describe("faviconSvg", () => {
  it("рисует табличку прозрачной картинкой SVG", () => {
    const svg = faviconSvg("ru");

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).not.toContain(siteThemeColor());
  });

  it("на разных языках рисует разные надписи", () => {
    const russian = faviconSvg("ru");

    const english = faviconSvg("en");

    expect(english).not.toBe(russian);
  });
});

describe("touchIconPng", () => {
  it("собирает квадратную картинку PNG нужной стороны", async () => {
    const png = await touchIconPng("en");

    const { format, width, height } = await sharp(png).metadata();
    expect({ format, width, height }).toEqual({
      format: "png",
      width: TOUCH_ICON_SIZE,
      height: TOUCH_ICON_SIZE,
    });
  });
});

describe("previewImagePng", () => {
  it("собирает картинку PNG размера превью ссылки", async () => {
    const png = await previewImagePng("ru");

    const { format, width, height } = await sharp(png).metadata();
    expect({ format, width, height }).toEqual({ format: "png", ...PREVIEW_IMAGE_SIZE });
  });
});
