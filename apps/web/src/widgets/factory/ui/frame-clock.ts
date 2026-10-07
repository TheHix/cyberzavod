// Часы цеха: шаг модели на каждый кадр браузера, пока сцена идёт, цех на экране и вкладка
// открыта. В остальное время requestAnimationFrame не крутится вовсе.

import type { FactoryModel } from "../model/factory.ts";

// После фоновой вкладки или подвисания кадр приходит с большим разрывом — сцена не прыгает.
const MAX_FRAME_MS = 100;

/**
 * Запускает часы цеха.
 * @param {FactoryModel} model Модель, которую двигают часы.
 * @param {HTMLElement} container Элемент цеха: пока он не на экране, часы стоят.
 * @returns {() => void} Останавливает часы и отписывается от браузера.
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
    // Пока идёт шаг, frameId ещё не ноль — подписка на $playing не запустит второй цикл.
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
