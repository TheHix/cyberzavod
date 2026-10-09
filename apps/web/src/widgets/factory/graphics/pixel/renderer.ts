import { CanvasRenderer, WebGLRenderer } from "pixi.js";

/** Factory renderer: WebGL, or Canvas without it. */
export type FactoryRenderer = WebGLRenderer | CanvasRenderer;

// WebGPU is not included: with WebGL it was never chosen, and it weighs about 50 KB. `Application`
// is not used: its `init` calls `autoDetectRenderer`, and with it the code of all renderers gets
// into the chunk.

/**
 * Creates a factory renderer for the browser's capabilities. The renderer is not initialized:
 * `init` is called by whoever embeds it.
 * @param {boolean} webGLSupported Whether the browser supports WebGL.
 * @returns {FactoryRenderer} A WebGL renderer, or Canvas if there is no WebGL.
 */
export function createRenderer(webGLSupported: boolean): FactoryRenderer {
  return webGLSupported ? new WebGLRenderer() : new CanvasRenderer();
}
