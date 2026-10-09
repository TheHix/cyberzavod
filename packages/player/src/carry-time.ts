// Carries a scene moment between scripts of one recording on different layouts: while workers walk
// different paths, the recording time at the same point of the scene must stay the same.

import { lastStartedIndex } from "./scene.ts";
import type { FactoryScript, Mark } from "./script.ts";

/** The scripts were built from different recordings: their marks do not correspond. */
export class ScriptMismatchError extends Error {}

function assertSameRecording(source: FactoryScript, target: FactoryScript): void {
  if (source.marks.length !== target.marks.length) {
    throw new ScriptMismatchError(
      `у сценариев разное число отметок: ${source.marks.length} и ${target.marks.length}`,
    );
  }

  for (const [index, mark] of source.marks.entries()) {
    const targetMark = target.marks[index];

    if (targetMark?.recordingTime !== mark.recordingTime) {
      throw new ScriptMismatchError(`у отметки ${index} разное время записи`);
    }
  }
}

function atOf(mark: Mark): number {
  return mark.at;
}

/**
 * Carries a scene moment into a script of the same recording on another layout: the same span
 * between marks and the same share of it, so the recording time does not change. Before the first
 * mark and after the last one, the offset from it is kept.
 * @param {FactoryScript} source Script in which the moment is given.
 * @param {FactoryScript} target Script of the same recording on another layout.
 * @param {number} time Scene moment in `source`, ms.
 * @returns {number} Scene moment in `target`, ms, within its duration.
 * @throws {ScriptMismatchError} If the scripts were built from different recordings.
 */
export function carryTime(source: FactoryScript, target: FactoryScript, time: number): number {
  assertSameRecording(source, target);
  const index = lastStartedIndex(source.marks, time, atOf);
  const anchorIndex = Math.max(index, 0);
  const from = source.marks[anchorIndex];
  const to = target.marks[anchorIndex];

  if (from === undefined || to === undefined) return clampTo(target, time);

  const next = source.marks[index + 1];
  const targetNext = target.marks[index + 1];
  const isOutsideMarkedSpan = index < 0 || next === undefined || targetNext === undefined;

  if (isOutsideMarkedSpan) return clampTo(target, to.at + (time - from.at));

  const share = (time - from.at) / (next.at - from.at);

  return clampTo(target, to.at + share * (targetNext.at - to.at));
}

function clampTo(target: FactoryScript, time: number): number {
  return Math.min(target.duration, Math.max(0, time));
}
