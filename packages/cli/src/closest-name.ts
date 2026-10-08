// Подсказка при опечатке: ближайшее по написанию имя из известных.

/** Наибольшее расстояние, на котором имя ещё считается опечаткой, а не другим словом. */
export const MAX_SUGGESTION_DISTANCE = 2;

/**
 * Расстояние Левенштейна: сколько вставок, удалений и замен превращают одну строку в другую.
 * @param {string} left Первая строка.
 * @param {string} right Вторая строка.
 * @returns {number} Число правок.
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
 * Находит среди известных имён то, что ближе всего к введённому слову, без учёта регистра.
 * @param {string} word Введённое слово.
 * @param {readonly Name[]} candidates Известные имена; при равенстве расстояний выигрывает первое.
 * @returns {Name | undefined} Ближайшее имя или `undefined`, если все дальше порога.
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
