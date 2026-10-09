const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Whether the viewer asks for less motion: then the floor stands until started, and a build series
 * does not move to the next one by itself.
 * @returns {boolean} `true` if reduced motion is enabled in the system.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}
