// Full site recordings the page has already asked for. Their files load lazily and only once:
// the series journal takes the recording now on the factory floor and, in advance, the next one.

import { atom, type ReadableAtom } from "nanostores";
import type { SessionRecord } from "@cyberzavod/core";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";
import { fetchRecording } from "../api/requests.ts";

/** Recordings already asked for, by id: loading, ready, or why it is missing. */
export type RecordingFiles = Readonly<Record<string, Remote<SessionRecord>>>;

/** Cache of full recordings: the store and the action that asks for a recording. */
export interface RecordingFilesModel {
  /** Recordings already asked for. */
  readonly $files: ReadableAtom<RecordingFiles>;
  /**
   * Asks for a recording if it has not been asked for yet: a repeated call sends no second request.
   * After a network failure the next call asks again.
   * @param {string} id Recording id.
   * @returns {Promise<void>} When the recording is received or it is clear why it is missing.
   */
  request(id: string): Promise<void>;
}

/**
 * Creates a cache of full recordings.
 * @param {(id: string) => Promise<SessionRecord>} fetchFile Recording request by id.
 * @returns {RecordingFilesModel} An empty cache.
 */
export function createRecordingFiles(
  fetchFile: (id: string) => Promise<SessionRecord>,
): RecordingFilesModel {
  const $files = atom<RecordingFiles>({});
  const requests = new Map<string, Promise<void>>();

  const store = (id: string, state: Remote<SessionRecord>) =>
    $files.set({ ...$files.get(), [id]: state });

  const load = async (id: string) => {
    store(id, LOADING);

    const state = await settle(() => fetchFile(id));

    store(id, state);
    // A network failure passes: next time we ask again, but 404 and a broken recording are final.
    if (state.status === "failed") requests.delete(id);
  };

  return {
    $files,
    request: (id) => {
      const pending = requests.get(id) ?? load(id);

      requests.set(id, pending);

      return pending;
    },
  };
}

/**
 * A recording from the cache: one not yet asked for counts as loading.
 * @param {RecordingFiles} files Recordings already asked for.
 * @param {string} id Recording id.
 * @returns {Remote<SessionRecord>} Recording state.
 */
export function recordingFileOf(files: RecordingFiles, id: string): Remote<SessionRecord> {
  return files[id] ?? LOADING;
}

const recordingFiles = createRecordingFiles((id) => fetchRecording(id));

/** Full site recordings on this page: a cache shared by all islands. */
export const $recordingFiles = recordingFiles.$files;

/**
 * Asks for a full site recording if it has not been asked for on this page yet.
 * @param {string} id Recording id.
 * @returns {Promise<void>} When the recording is received or it is clear why it is missing.
 */
export function requestRecordingFile(id: string): Promise<void> {
  return recordingFiles.request(id);
}
