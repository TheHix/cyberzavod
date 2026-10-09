// Turns: the share of an action's path and the shortest arc. Shared by the script (where a turn
// starts) and the frame (how it goes), so that both compute it the same way.

/**
 * Share of the way from `start` to `end`; an instant action is at 1 right away.
 * @param {number} start Start of the action, ms.
 * @param {number} end End of the action, ms.
 * @param {number} time Moment, ms.
 * @returns {number} Share from 0 to 1.
 */
export function progressOf(start: number, end: number, time: number): number {
  if (end <= start) return 1;

  return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

/**
 * Turn along the shortest arc: from 350° to 10° goes through 0°, not back around the whole
 * circle.
 * @param {number} from Heading at the start, radians.
 * @param {number} to Heading at the end, radians.
 * @param {number} progress Share of the turn from 0 to 1.
 * @returns {number} Heading, radians.
 */
export function turned(from: number, to: number, progress: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));

  return from + delta * progress;
}
