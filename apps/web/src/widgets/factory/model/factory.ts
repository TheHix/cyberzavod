// Модель цеха на Nano Stores: состояние проигрывания и всё, что из него следует. Без Solid
// и DOM — компоненты только читают сторы и вызывают действия, кадр сцены считает ядро.

import {
  buildScript,
  FOREMAN,
  sceneAt,
  summarize,
  type BriefRecording,
  type BuildStats,
  type FactoryScript,
  type MessageCue,
  type Point,
  type PromptCue,
  type Scene,
} from "@cyberzavod/core";
import { atom, computed, type ReadableAtom } from "nanostores";
import type { JournalScene, Speech } from "@/features/journal-sync";
import { speechAt, speechStart, speechTimeline } from "../lib/speech-timeline.ts";
import {
  advance,
  seek,
  startPlayback,
  togglePlaying,
  type Playback,
  type Speed,
} from "./playback.ts";

/** Готова ли графика цеха: пока она грузится, проигрывать нечем. */
export type GraphicsStatus = "loading" | "ready" | "failed";

/**
 * Модель цеха: сторы состояния (имена с `$`) и действия над ним. Журналу сборки она подходит
 * как `JournalScene`: `$speech` и `seekToSpeech`.
 */
export interface FactoryModel extends JournalScene {
  readonly script: FactoryScript;
  /** Итоги всей сборки: время, токены, промпты, возвраты. */
  readonly summary: BuildStats;
  readonly $status: ReadableAtom<GraphicsStatus>;
  readonly $playback: ReadableAtom<Playback>;
  /** Идёт ли сцена; меняется только при пуске и остановке — на него подписаны часы. */
  readonly $playing: ReadableAtom<boolean>;
  readonly $scene: ReadableAtom<Scene>;
  /** Момент записи, мс от начала сборки. */
  readonly $recordingTime: ReadableAtom<number>;
  /** Промпт, который сейчас говорит мастер рабочему станции. */
  readonly $prompt: ReadableAtom<PromptCue | null>;
  /** Где мастер, говорящий висящий промпт, — точка плана, над которой висит пузырь. */
  readonly $promptPosition: ReadableAtom<Point | null>;
  /** Реплика, которая сейчас висит над говорящим. */
  readonly $message: ReadableAtom<MessageCue | null>;
  /** Где говорящий — мастер или рабочий, — точка плана, над которой висит реплика. */
  readonly $messagePosition: ReadableAtom<Point | null>;
  /** Последний промпт или реплика, начавшиеся к этому моменту: их подсвечивает журнал. */
  readonly $speech: ReadableAtom<Speech | null>;
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
  setSpeed(speed: Speed): void;
  /** Раскрывает или сворачивает уточнения висящего промпта; раскрытие ставит паузу. */
  togglePromptDetails(): void;
  /** Перематывает к началу пузыря промпта или реплики; «идёт или пауза» не меняется. */
  seekToSpeech(speech: Speech): void;
}

/**
 * Создаёт модель цеха для записи: сценарий, сторы и действия. На каждый цех на странице —
 * своя модель.
 * @param {BriefRecording} recording Запись сборки без полных текстов реплик — их цеху не нужно.
 * @returns {FactoryModel} Модель, ещё не запущенная: ждёт готовности графики.
 */
export function createFactoryModel(recording: BriefRecording): FactoryModel {
  const script = buildScript(recording);
  const $status = atom<GraphicsStatus>("loading");
  const $playback = atom(startPlayback(script.duration, false));
  const $promptDetailsOpen = atom(false);
  const $playing = computed($playback, (playback) => playback.playing);
  const $scene = computed($playback, (playback) => sceneAt(script, playback.position));
  const $recordingTime = computed($scene, (scene) => scene.recordingTime);
  const $prompt = computed($scene, (scene) => scene.prompt?.cue ?? null);
  // Промпт говорит мастер, и пузырь висит над ним, там, где он стоит у станка.
  const $promptPosition = computed($scene, (scene) =>
    scene.prompt === null ? null : scene.foreman.position,
  );

  const $message = computed($scene, (scene) => scene.message?.cue ?? null);
  // Мастер говорит там, где он сейчас, рабочий — где стоит: у своего станка или у места встречи.
  const $messagePosition = computed($scene, (scene) => {
    const cue = scene.message?.cue;
    if (cue === undefined) return null;
    if (cue.speaker === FOREMAN) return scene.foreman.position;
    return scene.workers.find((worker) => worker.station === cue.speaker)?.position ?? null;
  });

  const timeline = speechTimeline(script);
  const $speech = computed($scene, (scene) => speechAt(timeline, scene.time));

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
    summary: summarize(recording),
    $status,
    $playback,
    $playing,
    $scene,
    $recordingTime,
    $prompt,
    $promptPosition,
    $message,
    $messagePosition,
    $speech,
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
    setSpeed: (speed) => update((playback) => ({ ...playback, speed })),
    togglePromptDetails: () => {
      if ($prompt.get() === null) return;
      const open = !$promptDetailsOpen.get();
      $promptDetailsOpen.set(open);
      // Чтобы прочитать уточнения, сцену останавливаем.
      if (open) pause();
    },
    seekToSpeech: (speech) => {
      const start = speechStart(timeline, speech);
      if (start !== undefined) update((playback) => seek(playback, start));
    },
  };
}
