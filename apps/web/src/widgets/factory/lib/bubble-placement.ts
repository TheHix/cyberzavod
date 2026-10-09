import type { Frame, ScreenPoint } from "../graphics/factory-graphics.ts";

/** Which way vertically the bubble opens from the point above the speaker. */
export type VerticalSide = "above" | "below";

/**
 * Where to open the bubble: the point above the speaker, the vertical side and the room toward it.
 */
export interface BubblePlacement extends ScreenPoint {
  readonly vertical: VerticalSide;
  /**
   * Room from the point to the field edge toward the opening side, CSS pixels: the bubble grows no
   * taller.
   */
  readonly roomHeight: number;
}

// The bubble stands centered above the speaker.
const HALF = 0.5;

/**
 * Computes how much vertical room there is from the point to the field edge toward the side the
 * bubble opens. A point beyond the field edge leaves no room in that direction.
 * @param {ScreenPoint} point Point above the speaker, in container coordinates.
 * @param {Frame} field Floor field free of the menu and HUD.
 * @param {VerticalSide} side Which way the bubble opens.
 * @returns {number} Distance to the top or bottom field edge, CSS pixels, not less than zero.
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
 * Decides which way vertically to open the bubble above the speaker: toward where there is more
 * room to the field edge, and how much room it has there so as not to go past the edge.
 * @param {ScreenPoint} point Point above the speaker, in container coordinates.
 * @param {Frame} field Floor field free of the menu and HUD.
 * @returns {BubblePlacement} Point in whole pixels, the opening side and the room to the field
 *   edge.
 */
export function placeBubble(point: ScreenPoint, field: Frame): BubblePlacement {
  // In whole pixels: at a fractional point the scroll shadow and the paper covering it in the
  // bubble fall on different screen pixels, and a gray strip remains at the text edge.
  const anchor = { x: Math.round(point.x), y: Math.round(point.y) };
  const hasMoreRoomBelow =
    verticalRoomOf(anchor, field, "below") > verticalRoomOf(anchor, field, "above");
  const vertical: VerticalSide = hasMoreRoomBelow ? "below" : "above";

  return { ...anchor, vertical, roomHeight: verticalRoomOf(anchor, field, vertical) };
}

/**
 * Places a bubble of known width horizontally: centered above the speaker, and if that takes it
 * past the field edge, flush against that edge. A bubble wider than the field is pushed to the left
 * edge.
 * @param {number} anchorX Horizontal point above the speaker, in container coordinates.
 * @param {number} bubbleWidth Bubble width, CSS pixels.
 * @param {Frame} field Floor field free of the menu and HUD.
 * @returns {number} Left edge of the bubble relative to the point above the speaker, CSS pixels.
 */
export function bubbleLeftOf(anchorX: number, bubbleWidth: number, field: Frame): number {
  const centeredLeft = anchorX - bubbleWidth * HALF;
  const lastLeft = field.x + field.width - bubbleWidth;
  const left = Math.max(Math.min(centeredLeft, lastLeft), field.x);

  return left - anchorX;
}
