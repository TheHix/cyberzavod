import { CanvasRenderer, WebGLRenderer } from "pixi.js";

/** Рендерер цеха: WebGL, а без него Canvas. */
export type FactoryRenderer = WebGLRenderer | CanvasRenderer;

// WebGPU не подключаем: при WebGL он не выбирался, а весит около 50 КБ. `Application` не
// используем: его `init` вызывает `autoDetectRenderer`, а вместе с ним в чанк попадает код
// всех рендереров.

/**
 * Создаёт рендерер цеха под возможности браузера. Рендерер не инициализирован: `init` вызывает
 * тот, кто его встраивает.
 * @param {boolean} webGLSupported Поддерживает ли браузер WebGL.
 * @returns {FactoryRenderer} WebGL-рендерер, а если WebGL нет — Canvas.
 */
export function createRenderer(webGLSupported: boolean): FactoryRenderer {
  return webGLSupported ? new WebGLRenderer() : new CanvasRenderer();
}
