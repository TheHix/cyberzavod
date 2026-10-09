// Link between the build journal and the factory floor. They are separate widgets that do not
// know each other: the factory floor connects its scene, the journal reads which recording it
// plays and which speech it has reached, and asks to seek. The recording on the floor may change
// (a build series), so the journal's speech is matched to it by recording id.

import { atom, type ReadableAtom } from "nanostores";

/** A recording's prompt, intervention or message: `index` is its number among its kind, from 0. */
export type Speech =
  | { readonly kind: "prompt"; readonly index: number }
  | { readonly kind: "intervention"; readonly index: number }
  | { readonly kind: "message"; readonly index: number };

/**
 * What the journal needs from the factory floor: which recording the scene plays, which speech it
 * has reached and how to seek to a speech.
 */
export interface JournalScene {
  /** Id of the recording the scene is playing now. */
  readonly $recordingId: ReadableAtom<string>;
  /** The last prompt, intervention or message started by the scene's moment. */
  readonly $speech: ReadableAtom<Speech | null>;
  /** Seeks the scene to the start of a speech. */
  seekToSpeech(speech: Speech): void;
}

interface Connection {
  readonly scene: JournalScene;
  readonly unsubscribe: () => void;
}

const $currentRecordingId = atom<string | null>(null);
const $currentSpeech = atom<Speech | null>(null);
let connection: Connection | null = null;

/** Id of the recording the connected factory floor plays; `null` means no factory floor. */
export const $sceneRecordingId: ReadableAtom<string | null> = $currentRecordingId;

/** The speech the connected factory floor has reached; `null` means no speech yet or no floor. */
export const $sceneSpeech: ReadableAtom<Speech | null> = $currentSpeech;

/**
 * Compares speeches by meaning, not by reference: Astro island props arrive through a Solid store
 * and are not reference-equal.
 * @param {Speech | null} current The speech the scene has reached, or `null`.
 * @param {Speech} candidate A journal entry's speech.
 * @returns {boolean} Whether the kind and number match.
 */
export function isSameSpeech(current: Speech | null, candidate: Speech): boolean {
  return current !== null && current.kind === candidate.kind && current.index === candidate.index;
}

// Carries the scene's recording and speech into the journal stores; one unsubscribe for both.
function followScene(scene: JournalScene): () => void {
  const stopRecording = scene.$recordingId.subscribe((id) => $currentRecordingId.set(id));
  const stopSpeech = scene.$speech.subscribe((speech) => $currentSpeech.set(speech));

  return () => {
    stopRecording();
    stopSpeech();
  };
}

/**
 * Connects the factory floor to the journal: carries its `$recordingId` and `$speech` into
 * `$sceneRecordingId` and `$sceneSpeech` and remembers the scene for seeking. A new connection
 * replaces the old one.
 * @param {JournalScene} scene Factory floor scene.
 * @returns {() => void} Disconnect: resets the recording and speech and forgets the scene if it is
 *   still this one.
 */
export function connectScene(scene: JournalScene): () => void {
  connection?.unsubscribe();

  const own: Connection = { scene, unsubscribe: followScene(scene) };

  connection = own;

  return () => {
    own.unsubscribe();
    if (connection !== own) return;

    connection = null;
    $currentRecordingId.set(null);
    $currentSpeech.set(null);
  };
}

/**
 * Asks the connected factory floor to seek the scene to a recording's speech. Without a floor, or
 * if the floor is already playing another recording, does nothing: a speech number only means
 * something within its recording.
 * @param {string} recordingId Id of the recording whose speech to seek to.
 * @param {Speech} speech A prompt, intervention or message of this recording.
 */
export function seekScene(recordingId: string, speech: Speech): void {
  const scene = connection?.scene;

  if (scene === undefined) return;

  const isPlayingRecording = scene.$recordingId.get() === recordingId;

  if (isPlayingRecording) scene.seekToSpeech(speech);
}
