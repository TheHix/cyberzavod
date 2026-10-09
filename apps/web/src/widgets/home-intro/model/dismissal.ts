/**
 * Browser storage key that remembers a visitor closed the home intro or went to the guide from it.
 * The page head reads it before the first paint, so a returning visitor never sees the block flash.
 */
export const INTRO_DISMISSED_KEY = "cyberzavod:home-intro-dismissed";

/** Attribute on `<html>` that hides the home intro while it is set. */
export const INTRO_DISMISSED_ATTRIBUTE = "data-home-intro-dismissed";

/** The part of `Storage` the dismissal needs: `localStorage` in the browser, a stub in tests. */
export type DismissalStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Whether the visitor has already dismissed the home intro.
 * @param {DismissalStorage} storage Browser storage.
 * @returns {boolean} `true` when the dismissal is remembered.
 */
export function isIntroDismissed(storage: DismissalStorage): boolean {
  try {
    return storage.getItem(INTRO_DISMISSED_KEY) !== null;
  } catch {
    // Storage blocked by the browser: the intro is shown, as for a first visit.
    return false;
  }
}

/**
 * Remembers that the visitor dismissed the home intro.
 * @param {DismissalStorage} storage Browser storage.
 */
export function rememberIntroDismissed(storage: DismissalStorage): void {
  try {
    storage.setItem(INTRO_DISMISSED_KEY, "1");
  } catch {
    // Storage blocked or full: the intro is hidden for this page only and comes back next visit.
  }
}
