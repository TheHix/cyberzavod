// Перенос момента сцены между сценариями одной записи на разных планах: пока рабочие ходят
// другими путями, время записи в той же точке сцены должно остаться тем же.

import { lastStartedIndex } from "./scene.ts";
import type { FactoryScript, Mark } from "./script.ts";

/** Сценарии построены по разным записям: их отметки не соответствуют друг другу. */
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
 * Переносит момент сцены в сценарий той же записи на другом плане: тот же отрезок между
 * отметками и та же его доля, поэтому время записи не меняется. До первой отметки и после
 * последней сохраняется смещение от неё.
 * @param {FactoryScript} source Сценарий, в котором задан момент.
 * @param {FactoryScript} target Сценарий той же записи на другом плане.
 * @param {number} time Момент сцены в `source`, мс.
 * @returns {number} Момент сцены в `target`, мс, в пределах его длительности.
 * @throws {ScriptMismatchError} Если сценарии построены по разным записям.
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
