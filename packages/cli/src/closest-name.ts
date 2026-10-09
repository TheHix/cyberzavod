// Typo hint: the known name closest in spelling.

/** The largest distance at which a name still counts as a typo rather than a different word. */
export const MAX_SUGGESTION_DISTANCE = 2;

/**
 * Levenshtein distance: how many insertions, deletions and substitutions turn one string into
 * another.
 * @param {string} left First string.
 * @param {string} right Second string.
 * @returns {number} Number of edits.
 */
export function editDistance(left: string, right: string): number {
  let previousRow = Array.from({ length: right.length + 1 }, (_cell, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const row = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      row.push(
        Math.min(
          (previousRow[rightIndex] ?? 0) + 1,
          (row[rightIndex - 1] ?? 0) + 1,
          (previousRow[rightIndex - 1] ?? 0) + substitutionCost,
        ),
      );
    }

    previousRow = row;
  }

  return previousRow[right.length] ?? 0;
}

/**
 * Finds the known name closest to the typed word, ignoring case.
 * @param {string} word Typed word.
 * @param {readonly Name[]} candidates Known names; on equal distances the first one wins.
 * @returns {Name | undefined} The closest name, or `undefined` if all are beyond the threshold.
 */
export function closestName<Name extends string>(
  word: string,
  candidates: readonly Name[],
): Name | undefined {
  const lowerWord = word.toLowerCase();
  let closest: Name | undefined;
  let closestDistance = MAX_SUGGESTION_DISTANCE + 1;

  for (const candidate of candidates) {
    const distance = editDistance(lowerWord, candidate.toLowerCase());

    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  return closest;
}
