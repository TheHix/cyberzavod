// Проигрыватель цеха: часы и кадры. Кадры рисуются, только пока сцена идёт, цех виден
// на экране и вкладка открыта; на паузе — один кадр после перемотки или смены размера.

import { sceneAt, type FactoryScript, type Scene } from "@cyberzavod/core";
import {
  advance,
  nextSpeed,
  seek,
  startPlayback,
  togglePlaying,
  type Playback,
} from "../model/playback.ts";
import type { FactoryView } from "../view/factory-view.ts";

// После фоновой вкладки или подвисания кадр приходит с большим разрывом — сцена не прыгает.
const MAX_FRAME_MS = 100;

/** Что нужно проигрывателю: сценарий, представление и куда сообщать о кадрах. */
export interface PlayerOptions {
  readonly script: FactoryScript;
  readonly view: FactoryView;
  readonly container: HTMLElement;
  readonly autoplay: boolean;
  /** Вызывается после каждого нарисованного кадра — для HTML поверх холста. */
  readonly onFrame: (scene: Scene, playback: Playback) => void;
}

/** Проигрыватель цеха: ведёт сцену по времени и рисует кадры через представление. */
export class FactoryPlayer {
  readonly #script: FactoryScript;
  readonly #view: FactoryView;
  readonly #container: HTMLElement;
  readonly #onFrame: PlayerOptions["onFrame"];
  readonly #resizeObserver: ResizeObserver;
  readonly #intersectionObserver: IntersectionObserver;
  #playback: Playback;
  #onScreen = true;
  #frameId = 0;
  #lastTime = 0;

  /**
   * Запускает проигрывание: рисует первый кадр и, если нужно, идёт дальше.
   * @param {PlayerOptions} options Сценарий, представление, контейнер и подписчик на кадры.
   */
  constructor(options: PlayerOptions) {
    this.#script = options.script;
    this.#view = options.view;
    this.#container = options.container;
    this.#onFrame = options.onFrame;
    this.#playback = startPlayback(options.script.duration, options.autoplay);

    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(this.#container);
    this.#intersectionObserver = new IntersectionObserver(([entry]) => {
      this.#onScreen = entry?.isIntersecting ?? true;
      this.#schedule();
    });
    this.#intersectionObserver.observe(this.#container);
    document.addEventListener("visibilitychange", this.#schedule);
    this.#draw();
    this.#schedule();
  }

  /** Ставит на паузу или продолжает; досмотренную сцену запускает с начала. */
  toggle(): void {
    this.#update(togglePlaying(this.#playback));
  }

  /** Ставит на паузу, если сцена идёт. */
  pause(): void {
    if (this.#playback.playing) this.#update(togglePlaying(this.#playback));
  }

  /**
   * Перематывает в момент сцены.
   * @param {number} position Момент сцены, мс.
   */
  seek(position: number): void {
    this.#update(seek(this.#playback, position));
  }

  /** Переключает скорость по кругу. */
  cycleSpeed(): void {
    this.#update(nextSpeed(this.#playback));
  }

  /** Останавливает кадры и отписывается от браузера. Представление освобождает владелец. */
  destroy(): void {
    cancelAnimationFrame(this.#frameId);
    this.#frameId = 0;
    this.#resizeObserver.disconnect();
    this.#intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.#schedule);
  }

  #update(playback: Playback): void {
    this.#playback = playback;
    this.#draw();
    this.#schedule();
  }

  #draw(): void {
    const scene = sceneAt(this.#script, this.#playback.position);
    this.#view.render(scene);
    this.#onFrame(scene, this.#playback);
  }

  #running(): boolean {
    return this.#playback.playing && this.#onScreen && document.visibilityState === "visible";
  }

  readonly #schedule = (): void => {
    if (this.#frameId !== 0 || !this.#running()) return;
    this.#lastTime = performance.now();
    this.#frameId = requestAnimationFrame(this.#tick);
  };

  readonly #tick = (now: number): void => {
    this.#frameId = 0;
    const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, now - this.#lastTime));
    this.#lastTime = now;
    this.#playback = advance(this.#playback, elapsed);
    this.#draw();
    if (this.#running()) this.#frameId = requestAnimationFrame(this.#tick);
  };

  readonly #resize = (): void => {
    this.#view.resize(this.#container.clientWidth, this.#container.clientHeight);
    this.#draw();
  };
}
