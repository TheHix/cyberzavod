// Промпты и реплики сценария одним списком по времени: по нему цех говорит журналу, до какой
// речи дошла сцена, и находит, куда перематывать. Чистые функции без Solid и DOM.

import type { FactoryScript } from "@cyberzavod/core";
import { isSameSpeech, type Speech } from "@/features/journal-sync";

/** Начало промпта или реплики на сцене. */
export interface SpeechMark {
  /** Момент сцены, мс, когда над говорящим появляется пузырь. */
  readonly start: number;
  /** Промпт или реплика, чей пузырь появляется в этот момент. */
  readonly speech: Speech;
}

/**
 * Собирает промпты и реплики сценария в один список по началу. Отметки создаются один раз на
 * сценарий: так `speechAt` отдаёт ту же ссылку, пока речь не сменилась.
 * @param {FactoryScript} script Сценарий цеха.
 * @returns {readonly SpeechMark[]} Отметки по возрастанию `start`.
 */
export function speechTimeline(script: FactoryScript): readonly SpeechMark[] {
  const marks: SpeechMark[] = [
    ...script.prompts.map((cue): SpeechMark => ({
      start: cue.start,
      speech: { kind: "prompt", index: cue.index },
    })),
    ...script.messages.map((cue): SpeechMark => ({
      start: cue.start,
      speech: { kind: "message", index: cue.index },
    })),
  ];
  return marks.sort((earlier, later) => earlier.start - later.start);
}

/**
 * Находит речь, до которой дошла сцена: последнюю, начавшуюся к этому моменту.
 * @param {readonly SpeechMark[]} timeline Отметки по возрастанию `start`.
 * @param {number} time Момент сцены, мс.
 * @returns {Speech | null} Речь или `null`, если до первой ещё не дошли.
 */
export function speechAt(timeline: readonly SpeechMark[], time: number): Speech | null {
  const started = timeline.findLast((mark) => mark.start <= time);
  return started?.speech ?? null;
}

/**
 * Находит момент сцены, когда над говорящим появляется пузырь этой речи.
 * @param {readonly SpeechMark[]} timeline Отметки сценария.
 * @param {Speech} speech Промпт или реплика.
 * @returns {number | undefined} Момент сцены, мс; `undefined`, если такой речи в сценарии нет.
 */
export function speechStart(timeline: readonly SpeechMark[], speech: Speech): number | undefined {
  return timeline.find((mark) => isSameSpeech(speech, mark.speech))?.start;
}
