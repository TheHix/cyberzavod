// Scene playback: where we are, whether it is running and at what speed. Pure functions: the
// factory model (factory.ts) applies them, and the requestAnimationFrame clock lives in
// ui/frame-clock.ts.

/** Playback speeds to choose from. */
export const SPEEDS = [1, 2, 4] as const;

/** Playback speed. */
export type Speed = (typeof SPEEDS)[number];

/** Playback state: the scene moment in ms, its length, whether it is running and at what speed. */
export interface Playback {
  readonly position: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly speed: Speed;
}

/**
 * Starts scene playback from the beginning.
 * @param {number} duration Scene duration, ms.
 * @param {boolean} playing Whether it runs at once.
 * @returns {Playback} State at the start of the scene.
 */
export function startPlayback(duration: number, playing: boolean): Playback {
  return { position: 0, duration, playing, speed: SPEEDS[0] };
}

/**
 * Advances playback by the elapsed time; stops at the end of the scene.
 * @param {Playback} playback Current state.
 * @param {number} elapsedMs How many ms passed since the previous frame.
 * @returns {Playback} State after the advance.
 */
export function advance(playback: Playback, elapsedMs: number): Playback {
  if (!playback.playing) return playback;

  const position = Math.min(playback.duration, playback.position + elapsedMs * playback.speed);

  return { ...playback, position, playing: position < playback.duration };
}

/**
 * Rewinds to a scene moment.
 * @param {Playback} playback Current state.
 * @param {number} position Scene moment, ms; outside the scene it is clamped to its bounds.
 * @returns {Playback} State at the new moment.
 */
export function seek(playback: Playback, position: number): Playback {
  return { ...playback, position: Math.min(playback.duration, Math.max(0, position)) };
}

/**
 * Moves playback into a scene of another length: whether it runs and the speed stay the same.
 * @param {Playback} playback Current state.
 * @param {number} duration Duration of the new scene, ms.
 * @param {number} position Moment in the new scene, ms; outside the scene it is clamped to its
 *   bounds.
 * @returns {Playback} The same playback in the new scene.
 */
export function withDuration(playback: Playback, duration: number, position: number): Playback {
  return seek({ ...playback, duration }, position);
}

/**
 * Whether the scene has reached the end.
 * @param {Playback} playback Current state.
 * @returns {boolean} `true` if the moment is the end of the scene.
 */
export function isAtEnd(playback: Playback): boolean {
  return playback.position >= playback.duration;
}

/**
 * Pauses or resumes; a finished scene restarts from the beginning.
 * @param {Playback} playback Current state.
 * @returns {Playback} State after the toggle.
 */
export function togglePlaying(playback: Playback): Playback {
  if (playback.playing) return { ...playback, playing: false };

  const position = isAtEnd(playback) ? 0 : playback.position;

  return { ...playback, position, playing: true };
}

/**
 * Recognizes a speed by its string form, as the interface toggles give it.
 * @param {string} value Speed as a string: `"2"`.
 * @returns {Speed | undefined} The speed, or undefined if SPEEDS has no such one.
 */
export function speedFrom(value: string): Speed | undefined {
  return SPEEDS.find((speed) => `${speed}` === value);
}
