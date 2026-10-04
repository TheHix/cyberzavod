// Модель цеха на Nano Stores: состояние проигрывания и всё, что из него следует. Без Solid
// и DOM — компоненты только читают сторы и вызывают действия, кадр сцены считает ядро.

import {
  buildScript,
  sceneAt,
  type FactoryScript,
  type Point,
  type PromptCue,
  type Recording,
  type Scene,
} from "@cyberzavod/core";
import { atom, computed, type ReadableAtom } from "nanostores";
import {
  advance,
  nextSpeed,
  seek,
  startPlayback,
  togglePlaying,
  type Playback,
} from "./playback.ts";

/** Готова ли графика цеха: пока она грузится, проигрывать нечем. */
export type GraphicsStatus = "loading" | "ready" | "failed";

/** Модель цеха: сторы состояния (имена с `$`) и действия над ним. */
export interface FactoryModel {
  readonly script: FactoryScript;
  readonly $status: ReadableAtom<GraphicsStatus>;
  readonly $playback: ReadableAtom<Playback>;
  /** Идёт ли сцена; меняется только при пуске и остановке — на него подписаны часы. */
  readonly $playing: ReadableAtom<boolean>;
  readonly $scene: ReadableAtom<Scene>;
  /** Момент записи, мс от начала сборки. */
  readonly $recordingTime: ReadableAtom<number>;
  /** Промпт, который сейчас висит над рабочим. */
  readonly $prompt: ReadableAtom<PromptCue | null>;
  /** Где рабочий, получивший висящий промпт, — точка плана, над которой висит пузырь. */
  readonly $promptPosition: ReadableAtom<Point | null>;
  /** Раскрыты ли уточнения висящего промпта; со сменой промпта закрываются. */
  readonly $promptDetailsOpen: ReadableAtom<boolean>;
  /** Графика готова; сцена сразу идёт, если `autoplay`. */
  start(autoplay: boolean): void;
  /** Графика не запустилась. */
  fail(): void;
  /** Сдвигает сцену на прошедшие мс, если она идёт. */
  advance(elapsedMs: number): void;
  /** Пауза или продолжение; досмотренную сцену запускает с начала. */
  toggle(): void;
  pause(): void;
  /** Перематывает в момент сцены, мс. */
  seek(position: number): void;
  cycleSpeed(): void;
  /** Раскрывает или сворачивает уточнения висящего промпта; раскрытие ставит паузу. */
  togglePromptDetails(): void;
}

/**
 * Создаёт модель цеха для записи: сценарий, сторы и действия. На каждый цех на странице —
 * своя модель.
 * @param {Recording} recording Запись сборки, которую проигрывает цех.
 * @returns {FactoryModel} Модель, ещё не запущенная: ждёт готовности графики.
 */
export function createFactoryModel(recording: Recording): FactoryModel {
  const script = buildScript(recording);
  const $status = atom<GraphicsStatus>("loading");
  const $playback = atom(startPlayback(script.duration, false));
  const $promptDetailsOpen = atom(false);
  const $playing = computed($playback, (playback) => playback.playing);
  const $scene = computed($playback, (playback) => sceneAt(script, playback.position));
  const $recordingTime = computed($scene, (scene) => scene.recordingTime);
  const $prompt = computed($scene, (scene) => scene.prompt?.cue ?? null);
  // Промпт висит над рабочим станка, у которого он получен.
  const $promptPosition = computed($scene, (scene) => {
    const cue = scene.prompt?.cue;
    if (cue === undefined) return null;
    return scene.workers.find((worker) => worker.station === cue.station)?.position ?? null;
  });

  const update = (change: (playback: Playback) => Playback) => {
    const promptBefore = $prompt.get();
    $playback.set(change($playback.get()));
    if ($prompt.get() !== promptBefore) $promptDetailsOpen.set(false);
  };
  const pause = () => {
    if ($playback.get().playing) update(togglePlaying);
  };

  return {
    script,
    $status,
    $playback,
    $playing,
    $scene,
    $recordingTime,
    $prompt,
    $promptPosition,
    $promptDetailsOpen,
    start: (autoplay) => {
      $status.set("ready");
      if (autoplay && !$playback.get().playing) update(togglePlaying);
    },
    fail: () => $status.set("failed"),
    advance: (elapsedMs) => update((playback) => advance(playback, elapsedMs)),
    toggle: () => update(togglePlaying),
    pause,
    seek: (position) => update((playback) => seek(playback, position)),
    cycleSpeed: () => update(nextSpeed),
    togglePromptDetails: () => {
      if ($prompt.get() === null) return;
      const open = !$promptDetailsOpen.get();
      $promptDetailsOpen.set(open);
      // Чтобы прочитать уточнения, сцену останавливаем.
      if (open) pause();
    },
  };
}
