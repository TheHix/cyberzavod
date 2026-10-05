import { CanvasRenderer, WebGLRenderer } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createRenderer } from "./renderer.ts";

describe("createRenderer", () => {
  it("выбирает WebGL, когда браузер его поддерживает", () => {
    const renderer = createRenderer(true);

    expect(renderer).toBeInstanceOf(WebGLRenderer);
  });

  it("берёт Canvas, когда WebGL нет", () => {
    const renderer = createRenderer(false);

    expect(renderer).toBeInstanceOf(CanvasRenderer);
  });
});
