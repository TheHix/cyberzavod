// Модель цеха на Nano Stores: состояние проигрывания и всё, что из него следует. Без Solid
// и DOM — компоненты только читают сторы и вызывают действия, кадр сцены считает ядро.

import { FOREMAN, summarize, type BriefSessionRecord, type BuildStats } from "@cyberzavod/core";
import {
  buildScript,
  carryTime,
  sceneAt,
  WIDE_LAYOUT,
  type FactoryLayout,
  type FactoryScript,
  type InterventionCue,
  type MessageCue,
  type Point,
  type PromptCue,
  type Scene,
} from "@cyberzavod/player";
import { atom, computed, type ReadableAtom } from "nanostores";
import type { JournalScene, Speech } from "@/features/journal-sync";
import { speechAt, speechStart, speechTimeline } from "../lib/speech-timeline.ts";
import {
  advance,
  seek,
  startPlayback,
  togglePlaying,
  withDuration,
  type Playback,
  type Speed,
} from "./playback.ts";

/** Готова ли графика цеха: пока она грузится, проигрывать нечем. */
export type GraphicsStatus = "loading" | "ready" | "failed";

// Всё, что меняется при смене плана, одним значением: его записывают целиком.
interface ProductionState {
  readonly layout: FactoryLayout;
  readonly script: FactoryScript;
  readonly playback: Playback;
}

/**
 * Модель цеха: сторы состояния (имена с `$`) и действия над ним. Журналу сборки она подходит
 * как `JournalScene`: `$speech` и `seekToSpeech`.
 */
export interface FactoryModel extends JournalScene {
  /** Сценарий цеха на текущем плане; со сменой плана заменяется. */
  readonly $script: ReadableAtom<FactoryScript>;
  /** План цеха, по которому построен сценарий. Сравнивается по ссылке: у сценария своя копия. */
  readonly $layout: ReadableAtom<FactoryLayout>;
  /** Итоги всей сборки: время, токены, промпты, возвраты, вмешательства. */
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
  /** Вмешательство человека, которое сейчас говорит мастер: станция стоит до его решения. */
  readonly $intervention: ReadableAtom<InterventionCue | null>;
  /** Где мастер, говорящий вмешательство, — точка плана, над которой висит пузырь. */
  readonly $interventionPosition: ReadableAtom<Point | null>;
  /** Реплика, которая сейчас висит над говорящим. */
  readonly $message: ReadableAtom<MessageCue | null>;
  /** Где говорящий — мастер или рабочий, — точка плана, над которой висит реплика. */
  readonly $messagePosition: ReadableAtom<Point | null>;
  /** Последний промпт, вмешательство или реплика, начавшиеся к этому моменту: их подсвечивает журнал. */
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
  /** Перематывает к началу пузыря промпта, вмешательства или реплики; «идёт или пауза» не меняется. */
  seekToSpeech(speech: Speech): void;
  /**
   * Переносит цех на другой план: сценарий строится заново, а момент записи, «идёт или пауза»
   * и скорость остаются. Тот же план — ничего не меняет.
   */
  setLayout(layout: FactoryLayout): void;
}

/**
 * Создаёт модель цеха для записи: сценарий, сторы и действия. На каждый цех на странице —
 * своя модель.
 * @param {BriefSessionRecord} recording Запись сборки без полных текстов реплик и вмешательств:
 *   они цеху не нужны.
 * @param {FactoryLayout} layout План цеха в начале; потом его меняет `setLayout`.
 * @returns {FactoryModel} Модель, ещё не запущенная: ждёт готовности графики.
 */
export function createFactoryModel(
  recording: BriefSessionRecord,
  layout: FactoryLayout = WIDE_LAYOUT,
): FactoryModel {
  const firstScript = buildScript(recording, layout);
  // План, сценарий и проигрывание меняются вместе: отдельными атомами подписчики увидели бы
  // новый сценарий со старым моментом.
  const $state = atom<ProductionState>({
    layout,
    script: firstScript,
    playback: startPlayback(firstScript.duration, false),
  });
  const $layout = computed($state, (state) => state.layout);
  const $script = computed($state, (state) => state.script);
  const $playback = computed($state, (state) => state.playback);
  const $status = atom<GraphicsStatus>("loading");
  const $promptDetailsOpen = atom(false);
  const $playing = computed($playback, (playback) => playback.playing);
  const $scene = computed($state, ({ script, playback }) => sceneAt(script, playback.position));
  const $recordingTime = computed($scene, (scene) => scene.recordingTime);
  const $prompt = computed($scene, (scene) => scene.prompt?.cue ?? null);
  // Промпт говорит мастер, и пузырь висит над ним, там, где он стоит у станка.
  const $promptPosition = computed($scene, (scene) =>
    scene.prompt === null ? null : scene.foreman.position,
  );

  const $intervention = computed($scene, (scene) => scene.intervention?.cue ?? null);
  // Вмешательство, как промпт, говорит мастер: пузырь висит над ним у станции, где стоит работа.
  const $interventionPosition = computed($scene, (scene) =>
    scene.intervention === null ? null : scene.foreman.position,
  );

  const $message = computed($scene, (scene) => scene.message?.cue ?? null);
  // Мастер говорит там, где он сейчас, рабочий — где стоит: у своего станка или у места встречи.
  const $messagePosition = computed($scene, (scene) => {
    const cue = scene.message?.cue;

    if (cue === undefined) return null;
    if (cue.speaker === FOREMAN) return scene.foreman.position;

    return scene.workers.find((worker) => worker.station === cue.speaker)?.position ?? null;
  });

  const $timeline = computed($script, speechTimeline);
  const $speech = computed([$timeline, $scene], (timeline, scene) =>
    speechAt(timeline, scene.time),
  );

  // Промпты разных сценариев — разные объекты, поэтому «тот же промпт» — по номеру.
  const closingDetailsOnNewPrompt = (change: () => void) => {
    const promptBefore = $prompt.get()?.index;

    change();
    if ($prompt.get()?.index !== promptBefore) $promptDetailsOpen.set(false);
  };
  const update = (change: (playback: Playback) => Playback) =>
    closingDetailsOnNewPrompt(() => {
      const state = $state.get();

      $state.set({ ...state, playback: change(state.playback) });
    });
  const pause = () => {
    if ($playback.get().playing) update(togglePlaying);
  };

  return {
    $script,
    $layout,
    summary: summarize(recording),
    $status,
    $playback,
    $playing,
    $scene,
    $recordingTime,
    $prompt,
    $promptPosition,
    $intervention,
    $interventionPosition,
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
      const start = speechStart($timeline.get(), speech);

      if (start !== undefined) update((playback) => seek(playback, start));
    },
    setLayout: (next) => {
      if (next === $layout.get()) return;

      const previous = $script.get();
      const script = buildScript(recording, next);
      const playback = $playback.get();
      const carried = withDuration(
        playback,
        script.duration,
        carryTime(previous, script, playback.position),
      );

      closingDetailsOnNewPrompt(() => $state.set({ layout: next, script, playback: carried }));
    },
  };
}
