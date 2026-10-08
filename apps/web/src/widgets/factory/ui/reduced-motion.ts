const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Просит ли зритель меньше движения: тогда цех стоит, пока его не пустят, а серия сборок сама
 * не переходит к следующей.
 * @returns {boolean} `true`, если в системе включено уменьшение движения.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}
