// The factory clock: a model step on every browser frame while the scene runs, the floor is on
// screen and the tab is open. The rest of the time requestAnimationFrame does not run at all.

import type { FactoryModel } from "../model/factory.ts";

// After a background tab or a freeze a frame arrives with a large gap, and the scene does not jump.
const MAX_FRAME_MS = 100;

/**
 * Starts the factory clock.
 * @param {FactoryModel} model The model the clock moves.
 * @param {HTMLElement} container The factory element: while it is off screen, the clock stands.
 * @returns {() => void} Stops the clock and unsubscribes from the browser.
 */
export function startFrameClock(model: FactoryModel, container: HTMLElement): () => void {
  let frameId = 0;
  let lastTime = 0;
  let isOnScreen = true;

  const isRunning = () =>
    model.$playing.get() && isOnScreen && document.visibilityState === "visible";

  const tick = (now: number) => {
    const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, now - lastTime));

    lastTime = now;
    // While a step runs, frameId is not zero yet, so the $playing subscription will not start a
    // second loop.
    model.advance(elapsed);
    frameId = isRunning() ? requestAnimationFrame(tick) : 0;
  };

  const resume = () => {
    if (frameId !== 0 || !isRunning()) return;

    lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  const intersection = new IntersectionObserver(([entry]) => {
    isOnScreen = entry?.isIntersecting ?? true;
    resume();
  });

  intersection.observe(container);
  document.addEventListener("visibilitychange", resume);
  const stopListening = model.$playing.subscribe(resume);

  return () => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    intersection.disconnect();
    document.removeEventListener("visibilitychange", resume);
    stopListening();
  };
}
