import type { Frame, ScreenPoint } from "../graphics/factory-graphics.ts";

/** Куда по высоте раскрывается пузырь от точки над говорящим. */
export type VerticalSide = "above" | "below";

/** Где открыть пузырь: точка над говорящим, сторона раскрытия по высоте и место в ту сторону. */
export interface BubblePlacement extends ScreenPoint {
  readonly vertical: VerticalSide;
  /** Сколько места от точки до края поля в сторону раскрытия, CSS-пиксели: выше пузырь не растёт. */
  readonly roomHeight: number;
}

// Пузырь стоит над говорящим серединой.
const HALF = 0.5;

/**
 * Считает, сколько места по высоте от точки до края поля в сторону раскрытия пузыря. Точка за
 * краем поля места в ту сторону не оставляет.
 * @param {ScreenPoint} point Точка над говорящим, в координатах контейнера.
 * @param {Frame} field Поле цеха, свободное от меню и HUD.
 * @param {VerticalSide} side Куда раскрывается пузырь.
 * @returns {number} Расстояние до верхнего или нижнего края поля, CSS-пиксели, не меньше нуля.
 */
export function verticalRoomOf(point: ScreenPoint, field: Frame, side: VerticalSide): number {
  switch (side) {
    case "above":
      return Math.max(point.y - field.y, 0);
    case "below":
      return Math.max(field.y + field.height - point.y, 0);
  }
}

/**
 * Решает, куда по высоте раскрыть пузырь над говорящим: туда, где до края поля больше места, — и
 * сколько места у него там, чтобы не уйти за край.
 * @param {ScreenPoint} point Точка над говорящим, в координатах контейнера.
 * @param {Frame} field Поле цеха, свободное от меню и HUD.
 * @returns {BubblePlacement} Точка в целых пикселях, сторона раскрытия и место до края поля.
 */
export function placeBubble(point: ScreenPoint, field: Frame): BubblePlacement {
  // В целых пикселях: на дробной точке тень прокрутки и закрывающая её бумага в пузыре
  // попадают на разные пиксели экрана, и у края текста остаётся серая полоска.
  const anchor = { x: Math.round(point.x), y: Math.round(point.y) };
  const hasMoreRoomBelow =
    verticalRoomOf(anchor, field, "below") > verticalRoomOf(anchor, field, "above");
  const vertical: VerticalSide = hasMoreRoomBelow ? "below" : "above";

  return { ...anchor, vertical, roomHeight: verticalRoomOf(anchor, field, vertical) };
}

/**
 * Ставит пузырь известной ширины по горизонтали: серединой над говорящим, а если так он выходит
 * за край поля, — вплотную к этому краю. Пузырь шире поля прижимается к левому краю.
 * @param {number} anchorX Точка над говорящим по горизонтали, в координатах контейнера.
 * @param {number} bubbleWidth Ширина пузыря, CSS-пиксели.
 * @param {Frame} field Поле цеха, свободное от меню и HUD.
 * @returns {number} Левый край пузыря относительно точки над говорящим, CSS-пиксели.
 */
export function bubbleLeftOf(anchorX: number, bubbleWidth: number, field: Frame): number {
  const centeredLeft = anchorX - bubbleWidth * HALF;
  const lastLeft = field.x + field.width - bubbleWidth;
  const left = Math.max(Math.min(centeredLeft, lastLeft), field.x);

  return left - anchorX;
}
