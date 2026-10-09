// A gallery recording on the `/r/` page: two islands show it, the factory floor and the build
// journal. The recording loads once, both islands read one store.

import { atom, type ReadableAtom } from "nanostores";
import { fetchSharedRecording, queryParamOf, type SharedRecording } from "@/entities/gallery";
import { LOADING, MISSING, settle, type Remote } from "@/shared/api/remote.ts";

/** A gallery recording: the store and the action that opens it. */
export interface SharedRecordingModel {
  /** The recording from the page link: loading, ready, or why it is missing. */
  readonly $recording: ReadableAtom<Remote<SharedRecording>>;
  /**
   * Opens the recording from the address parameters. A repeated call sends no second request.
   * @param {string} search Address parameters, `location.search`.
   * @returns {Promise<void>} When the recording is received or it is clear why it is missing.
   */
  open(search: string): Promise<void>;
}

/**
 * Creates the gallery recording model.
 * @param {(slug: string) => Promise<SharedRecording>} fetchRecording Recording request by slug.
 * @returns {SharedRecordingModel} A model with the initial "loading" state.
 */
export function createSharedRecordingModel(
  fetchRecording: (slug: string) => Promise<SharedRecording>,
): SharedRecordingModel {
  const $recording = atom<Remote<SharedRecording>>(LOADING);
  let opening: Promise<void> | undefined;

  const load = async (search: string) => {
    const slug = queryParamOf(search, "recording");

    if (slug === undefined) {
      $recording.set(MISSING);

      return;
    }

    $recording.set(await settle(() => fetchRecording(slug)));
  };

  return {
    $recording,
    open: (search) => {
      opening ??= load(search);

      return opening;
    },
  };
}

const sharedRecording = createSharedRecordingModel((slug) => fetchSharedRecording(slug));

/** The gallery recording on this page: shared by the factory floor and journal islands. */
export const $sharedRecording = sharedRecording.$recording;

/**
 * Opens the gallery recording from the page address parameters; a second island sends no second
 * request.
 * @param {string} search Address parameters, `location.search`.
 * @returns {Promise<void>} When the recording is received or it is clear why it is missing.
 */
export function openSharedRecording(search: string): Promise<void> {
  return sharedRecording.open(search);
}
