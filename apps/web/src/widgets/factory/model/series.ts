// A build series on one floor: recordings go one after another in a loop. The floor is not
// recreated: its model gets the next recording via `load`, and the graphics stay the same.

import { computed, type ReadableAtom } from "nanostores";
import { nextIndexInCircle } from "@/shared/lib/circle.ts";
import type { SeriesBuild } from "../lib/series-builds.ts";
import { createFactoryModel, type FactoryModel } from "./factory.ts";
import { isAtEnd } from "./playback.ts";

/** A build series on one floor: the factory model and which series build is on it now. */
export interface FactorySeries {
  /** The factory model that plays the series; the series changes the recording in it. */
  readonly model: FactoryModel;
  /** The series build the floor is playing now. */
  readonly $current: ReadableAtom<SeriesBuild>;
  /**
   * Follows the floor: when a recording has played to the end by itself, puts the next one in the
   * loop and continues. A pause by the human does not move the series: the series waits.
   * @returns {() => void} Stops following.
   */
  follow(): () => void;
}

/**
 * Creates a build series: the floor starts with the first one and moves to the next ones by itself
 * via `follow`.
 * @param {readonly SeriesBuild[]} builds Series builds in playback order.
 * @returns {FactorySeries} The series at the first build; the factory model still waits for the
 *   graphics.
 * @throws {Error} If the series has no builds.
 */
export function createFactorySeries(builds: readonly SeriesBuild[]): FactorySeries {
  const [first] = builds;

  if (first === undefined) throw new Error("серия без сборок: цеху нечего проигрывать");

  const model = createFactoryModel(first.recording);
  const indexOf = (recordingId: string) =>
    builds.findIndex((build) => build.recording.id === recordingId);
  const $index = computed(model.$recordingId, indexOf);
  // Only the series puts a recording on the floor, so the number is always within its bounds.
  const $current = computed($index, (index) => builds[index] ?? first);

  const playNext = () => {
    const nextIndex = nextIndexInCircle($index.get(), builds.length);
    const next = builds[nextIndex] ?? first;

    model.load(next.recording);
    model.play();
  };

  return {
    model,
    $current,
    follow: () =>
      // The scene stops by itself only at the end of the recording. A human's pause stops it before
      // the end, and rewinding while paused does not start the scene: in both cases the series
      // waits.
      model.$playing.listen((playing) => {
        const hasFinished = !playing && isAtEnd(model.$playback.get());

        if (hasFinished) playNext();
      }),
  };
}
