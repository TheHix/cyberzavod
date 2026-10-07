// Отметки шкалы сцены: желаемое время сцены у события может оказаться раньше предыдущего,
// потому что речь стоит в очереди. Здесь такие отметки выравниваются, чтобы время записи
// на сцене не шло назад.

import type { Mark } from "./script.ts";

// Опорная отметка держит своё время сцены: первая и каждая, что не раньше последней опорной.
// Отметка того же времени с тем же временем записи ей тождественна и тоже опорная.
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

// Место отметки между опорными слева и справа по доле времени записи; без правой опорной
// или при том же времени записи — на опорной слева.
function placedBetween(mark: Mark, left: Mark, right: Mark | undefined): number {
  if (right === undefined || right.recordingTime === left.recordingTime) return left.at;

  const share =
    (mark.recordingTime - left.recordingTime) / (right.recordingTime - left.recordingTime);
  const placed = left.at + (right.at - left.at) * share;

  return Math.min(right.at, Math.max(left.at, placed));
}

/**
 * Выравнивает отметки так, чтобы их время сцены не убывало: отметка, которую обогнала
 * очередь речи, встаёт между опорными по доле времени записи. Наружу пакета не выходит.
 * @param {readonly Mark[]} marks Отметки в порядке записи: время записи не убывает, `at` — желаемое.
 * @returns {Mark[]} Те же отметки в том же порядке, с теми же временем записи и счётчиками.
 * @throws {Error} Если у неопорной отметки нет опорной слева: это ошибка программы, первая отметка опорная.
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
