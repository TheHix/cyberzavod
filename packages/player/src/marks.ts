// Scene timeline marks: the desired scene time of an event may come before the previous one,
// because speech waits in a queue. Such marks are aligned here so that the recording time
// on the scene never goes backwards.

import type { Mark } from "./script.ts";

// An anchor mark keeps its scene time: the first one and each one not earlier than the last anchor.
// A mark at the same time with the same recording time is identical to it and is an anchor too.
function isAnchor(mark: Mark, lastAnchor: Mark | undefined): boolean {
  if (lastAnchor === undefined) return true;
  if (mark.at > lastAnchor.at) return true;

  return mark.at === lastAnchor.at && mark.recordingTime === lastAnchor.recordingTime;
}

function anchorIndexesOf(marks: readonly Mark[]): number[] {
  const indexes: number[] = [];
  let lastAnchor: Mark | undefined;

  for (const [index, mark] of marks.entries()) {
    if (!isAnchor(mark, lastAnchor)) continue;

    indexes.push(index);
    lastAnchor = mark;
  }

  return indexes;
}

// Place of a mark between the left and right anchors by share of recording time; with no right
// anchor or with the same recording time, at the left anchor.
function placedBetween(mark: Mark, left: Mark, right: Mark | undefined): number {
  if (right === undefined || right.recordingTime === left.recordingTime) return left.at;

  const share =
    (mark.recordingTime - left.recordingTime) / (right.recordingTime - left.recordingTime);
  const placed = left.at + (right.at - left.at) * share;

  return Math.min(right.at, Math.max(left.at, placed));
}

/**
 * Aligns marks so that their scene time never decreases: a mark overtaken by the speech queue
 * is placed between anchors by share of recording time. Does not leave the package.
 * @param {readonly Mark[]} marks Marks in recording order: recording time never decreases, `at`
 * is desired.
 * @returns {Mark[]} The same marks in the same order, with the same recording time and counters.
 * @throws {Error} If a non-anchor mark has no anchor on its left: a program error, the first mark
 * is an anchor.
 */
export function alignMarks(marks: readonly Mark[]): Mark[] {
  const anchors = anchorIndexesOf(marks);
  const aligned: Mark[] = [];
  let nextAnchor = 0;
  let left: Mark | undefined;

  for (const [index, mark] of marks.entries()) {
    if (anchors[nextAnchor] === index) {
      nextAnchor += 1;
      left = mark;
      aligned.push(mark);
      continue;
    }
    if (left === undefined) {
      throw new Error(`у отметки ${index} нет опорной слева: первая отметка всегда опорная`);
    }

    const rightIndex = anchors[nextAnchor];
    const right = rightIndex === undefined ? undefined : marks[rightIndex];

    aligned.push({ ...mark, at: placedBetween(mark, left, right) });
  }

  return aligned;
}
