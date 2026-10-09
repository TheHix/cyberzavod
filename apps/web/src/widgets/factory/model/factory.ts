// Factory model on Nano Stores: playback state and everything that follows from it. Without Solid
// and DOM: components only read stores and call actions, the core computes the scene frame.

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

/** Whether the factory graphics are ready: while they load, there is nothing to play with. */
export type GraphicsStatus = "loading" | "ready" | "failed";

// Everything that changes when the plan or the recording changes, as one value: it is written
// whole.
interface ProductionState {
  readonly recording: BriefSessionRecord;
  readonly layout: FactoryLayout;
  readonly script: FactoryScript;
  readonly playback: Playback;
}

/**
 * Factory model: state stores (names with `$`) and actions on it. It fits the build journal as
 * `JournalScene`: `$recordingId`, `$speech` and `seekToSpeech`.
 */
export interface FactoryModel extends JournalScene {
  /** The recording the floor plays; `load` changes it. */
  readonly $recording: ReadableAtom<BriefSessionRecord>;
  /**
   * Floor script of the current recording on the current plan; replaced when the plan or recording
   * changes.
   */
  readonly $script: ReadableAtom<FactoryScript>;
  /** Floor plan the script is built on. Compared by reference: the script has its own copy. */
  readonly $layout: ReadableAtom<FactoryLayout>;
  /**
   * Totals of the whole build of the current recording: time, tokens, prompts, rework,
   * interventions.
   */
  readonly $summary: ReadableAtom<BuildStats>;
  readonly $status: ReadableAtom<GraphicsStatus>;
  readonly $playback: ReadableAtom<Playback>;
  /** Whether the scene is running; changes only on start and stop, the clock subscribes to it. */
  readonly $playing: ReadableAtom<boolean>;
  readonly $scene: ReadableAtom<Scene>;
  /** Recording moment, ms from the start of the build. */
  readonly $recordingTime: ReadableAtom<number>;
  /** The prompt the foreman is saying to the station worker now. */
  readonly $prompt: ReadableAtom<PromptCue | null>;
  /** Where the foreman saying the shown prompt is: the plan point the bubble hangs over. */
  readonly $promptPosition: ReadableAtom<Point | null>;
  /** The human intervention the foreman is saying now: the station waits for the decision. */
  readonly $intervention: ReadableAtom<InterventionCue | null>;
  /** Where the foreman saying the intervention is: the plan point the bubble hangs over. */
  readonly $interventionPosition: ReadableAtom<Point | null>;
  /** The message shown above the speaker now. */
  readonly $message: ReadableAtom<MessageCue | null>;
  /** Where the speaker, the foreman or a worker, is: the plan point the message hangs over. */
  readonly $messagePosition: ReadableAtom<Point | null>;
  /**
   * The last prompt, intervention or message started by this moment: the journal highlights it.
   */
  readonly $speech: ReadableAtom<Speech | null>;
  /** Whether the details of the shown prompt are expanded; they close when the prompt changes. */
  readonly $promptDetailsOpen: ReadableAtom<boolean>;
  /** Graphics are ready; the scene runs at once if `autoplay`. */
  start(autoplay: boolean): void;
  /** Graphics failed to start. */
  fail(): void;
  /** Advances the scene by the elapsed ms if it is running. */
  advance(elapsedMs: number): void;
  /** Pause or resume; a finished scene restarts from the beginning. */
  toggle(): void;
  /** Resumes the scene if it is stopped; a finished one restarts from the beginning. */
  play(): void;
  pause(): void;
  /** Rewinds to a scene moment, ms. */
  seek(position: number): void;
  setSpeed(speed: Speed): void;
  /** Expands or collapses the details of the shown prompt; expanding pauses. */
  togglePromptDetails(): void;
  /**
   * Rewinds to the start of a prompt, intervention or message bubble; "running or paused" does not
   * change.
   */
  seekToSpeech(speech: Speech): void;
  /**
   * Moves the floor to another plan: the script is rebuilt, while the recording moment, "running or
   * paused" and the speed stay. The same plan changes nothing.
   */
  setLayout(layout: FactoryLayout): void;
  /**
   * Puts another recording on the floor: the script is built on the current plan, the scene goes
   * to the start, the speed and "running or paused" stay, the prompt details close. The graphics
   * stay the same.
   */
  load(recording: BriefSessionRecord): void;
}

/**
 * Creates the factory model for a recording: script, stores and actions. Each floor on the page
 * has its own model.
 * @param {BriefSessionRecord} recording The first build recording without full message and
 *   intervention texts: the floor does not need them. Later `load` changes the recording.
 * @param {FactoryLayout} layout Floor plan at the start; later `setLayout` changes it.
 * @returns {FactoryModel} A model not started yet: it waits for the graphics to be ready.
 */
export function createFactoryModel(
  recording: BriefSessionRecord,
  layout: FactoryLayout = WIDE_LAYOUT,
): FactoryModel {
  const firstScript = buildScript(recording, layout);
  // The recording, plan, script and playback change together: with separate atoms subscribers would
  // see a new script with an old moment.
  const $state = atom<ProductionState>({
    recording,
    layout,
    script: firstScript,
    playback: startPlayback(firstScript.duration, false),
  });
  const $recording = computed($state, (state) => state.recording);
  const $recordingId = computed($recording, (current) => current.id);
  const $summary = computed($recording, summarize);
  const $layout = computed($state, (state) => state.layout);
  const $script = computed($state, (state) => state.script);
  const $playback = computed($state, (state) => state.playback);
  const $status = atom<GraphicsStatus>("loading");
  const $promptDetailsOpen = atom(false);
  const $playing = computed($playback, (playback) => playback.playing);
  const $scene = computed($state, ({ script, playback }) => sceneAt(script, playback.position));
  const $recordingTime = computed($scene, (scene) => scene.recordingTime);
  const $prompt = computed($scene, (scene) => scene.prompt?.cue ?? null);
  // The foreman says the prompt, and the bubble hangs over them, where they stand at the machine.
  const $promptPosition = computed($scene, (scene) =>
    scene.prompt === null ? null : scene.foreman.position,
  );

  const $intervention = computed($scene, (scene) => scene.intervention?.cue ?? null);
  // Like a prompt, the foreman says an intervention: the bubble hangs over them at the station
  // where work waits.
  const $interventionPosition = computed($scene, (scene) =>
    scene.intervention === null ? null : scene.foreman.position,
  );

  const $message = computed($scene, (scene) => scene.message?.cue ?? null);
  // The foreman speaks where they are now, a worker where they stand: at their machine or at the
  // meeting spot.
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

  // Prompts of different scripts are different objects, so "the same prompt" is by number.
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
  const play = () => {
    if (!$playback.get().playing) update(togglePlaying);
  };

  return {
    $recording,
    $recordingId,
    $script,
    $layout,
    $summary,
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
      if (autoplay) play();
    },
    fail: () => $status.set("failed"),
    advance: (elapsedMs) => update((playback) => advance(playback, elapsedMs)),
    toggle: () => update(togglePlaying),
    play,
    pause,
    seek: (position) => update((playback) => seek(playback, position)),
    setSpeed: (speed) => update((playback) => ({ ...playback, speed })),
    togglePromptDetails: () => {
      if ($prompt.get() === null) return;

      const open = !$promptDetailsOpen.get();

      $promptDetailsOpen.set(open);
      // To read the details, the scene is stopped.
      if (open) pause();
    },
    seekToSpeech: (speech) => {
      const start = speechStart($timeline.get(), speech);

      if (start !== undefined) update((playback) => seek(playback, start));
    },
    setLayout: (next) => {
      if (next === $layout.get()) return;

      const state = $state.get();
      const script = buildScript(state.recording, next);
      const carried = withDuration(
        state.playback,
        script.duration,
        carryTime(state.script, script, state.playback.position),
      );

      closingDetailsOnNewPrompt(() =>
        $state.set({ ...state, layout: next, script, playback: carried }),
      );
    },
    load: (next) => {
      const state = $state.get();
      const script = buildScript(next, state.layout);
      const fromStart = withDuration(state.playback, script.duration, 0);

      // A prompt of the new recording may match the old one by number, so the details always close.
      $promptDetailsOpen.set(false);
      $state.set({ ...state, recording: next, script, playback: fromStart });
    },
  };
}
