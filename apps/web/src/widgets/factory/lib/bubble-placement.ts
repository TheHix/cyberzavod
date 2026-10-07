import type { Frame, ScreenPoint } from "../graphics/factory-graphics.ts";

/** Где открыть пузырь промпта: точка над рабочим и стороны, куда он раскрывается. */
export interface BubblePlacement extends ScreenPoint {
  readonly vertical: "above" | "below";
  readonly horizontal: "start" | "center" | "end";
}

// У края поля — крайняя треть ширины — пузырь прижимается к краю, а не центрируется.
const EDGE_ZONE = 1 / 3;
// Выше середины поля пузырь раскрывается вниз, ниже — вверх.
const MIDDLE = 0.5;

/**
 * Решает, куда раскрыть пузырь промпта над рабочим: к середине поля, чтобы не уйти за край.
 * @param {ScreenPoint} point Где рабочий, в координатах контейнера.
 * @param {Frame} field Поле цеха, свободное от меню и HUD.
 * @returns {BubblePlacement} Точка и стороны раскрытия.
 */
export function placeBubble(point: ScreenPoint, field: Frame): BubblePlacement {
  const across = (point.x - field.x) / field.width;
  const down = (point.y - field.y) / field.height;

  return {
    x: point.x,
    y: point.y,
    vertical: down < MIDDLE ? "below" : "above",
    horizontal: horizontalSideOf(across),
  };
}

function horizontalSideOf(across: number): BubblePlacement["horizontal"] {
  if (across < EDGE_ZONE) return "start";
  if (across > 1 - EDGE_ZONE) return "end";

  return "center";
}
