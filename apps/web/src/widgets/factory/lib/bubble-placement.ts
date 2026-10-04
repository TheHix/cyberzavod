import type { ScreenPoint } from "../graphics/factory-graphics.ts";

/** Где открыть пузырь промпта: точка над рабочим и стороны, куда он раскрывается. */
export interface BubblePlacement extends ScreenPoint {
  readonly vertical: "above" | "below";
  readonly horizontal: "start" | "center" | "end";
}

/** Размер пола цеха, CSS-пиксели. */
export interface FloorSize {
  readonly width: number;
  readonly height: number;
}

// У края пола — крайняя треть ширины — пузырь прижимается к краю, а не центрируется.
const EDGE_ZONE = 1 / 3;

/**
 * Решает, куда раскрыть пузырь промпта над рабочим: к середине пола, чтобы не уйти за край.
 * @param {ScreenPoint} point Где рабочий, в координатах пола.
 * @param {FloorSize} floor Размер пола.
 * @returns {BubblePlacement} Точка и стороны раскрытия.
 */
export function placeBubble(point: ScreenPoint, floor: FloorSize): BubblePlacement {
  const horizontal =
    point.x < floor.width * EDGE_ZONE
      ? "start"
      : point.x > floor.width * (1 - EDGE_ZONE)
        ? "end"
        : "center";
  return {
    x: point.x,
    y: point.y,
    vertical: point.y < floor.height / 2 ? "below" : "above",
    horizontal,
  };
}
