// Prompts, interventions and messages of the script in one list by time: by it the floor tells
// the journal which speech the scene has reached, and finds where to rewind. Pure functions
// without Solid and DOM.

import type { FactoryScript } from "@cyberzavod/player";
import { isSameSpeech, type Speech } from "@/features/journal-sync";

/** Start of a prompt, intervention or message in the scene. */
export interface SpeechMark {
  /** Scene moment, ms, when the bubble appears above the speaker. */
  readonly start: number;
  /** The prompt, intervention or message whose bubble appears at this moment. */
  readonly speech: Speech;
}

/**
 * Collects the script's prompts, interventions and messages into one list by start. Marks are
 * created once per script: this way `speechAt` returns the same reference until the speech changes.
 * @param {FactoryScript} script Floor script.
 * @returns {readonly SpeechMark[]} Marks in ascending `start` order.
 */
export function speechTimeline(script: FactoryScript): readonly SpeechMark[] {
  const marks: SpeechMark[] = [
    ...script.prompts.map((cue): SpeechMark => ({
      start: cue.start,
      speech: { kind: "prompt", index: cue.index },
    })),
    ...script.interventions.map((cue): SpeechMark => ({
      start: cue.start,
      speech: { kind: "intervention", index: cue.index },
    })),
    ...script.messages.map((cue): SpeechMark => ({
      start: cue.start,
      speech: { kind: "message", index: cue.index },
    })),
  ];

  return marks.sort((earlier, later) => earlier.start - later.start);
}

/**
 * Finds the speech the scene has reached: the last one started by this moment.
 * @param {readonly SpeechMark[]} timeline Marks in ascending `start` order.
 * @param {number} time Scene moment, ms.
 * @returns {Speech | null} The speech, or `null` if the first one has not been reached yet.
 */
export function speechAt(timeline: readonly SpeechMark[], time: number): Speech | null {
  const started = timeline.findLast((mark) => mark.start <= time);

  return started?.speech ?? null;
}

/**
 * Finds the scene moment when the bubble of this speech appears above the speaker.
 * @param {readonly SpeechMark[]} timeline Script marks.
 * @param {Speech} speech Prompt, intervention or message.
 * @returns {number | undefined} Scene moment, ms; `undefined` if the script has no such speech.
 */
export function speechStart(timeline: readonly SpeechMark[], speech: Speech): number | undefined {
  return timeline.find((mark) => isSameSpeech(speech, mark.speech))?.start;
}
