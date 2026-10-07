// Повороты: доля пути действия и кратчайшая дуга. Общие у сценария (откуда начинается поворот)
// и кадра (как он идёт), чтобы они считали одинаково.

/**
 * Доля пройденного от `start` до `end`; у мгновенного действия — сразу 1.
 * @param {number} start Начало действия, мс.
 * @param {number} end Конец действия, мс.
 * @param {number} time Момент, мс.
 * @returns {number} Доля от 0 до 1.
 */
export function progressOf(start: number, end: number, time: number): number {
  if (end <= start) return 1;

  return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

/**
 * Поворот по кратчайшей дуге: от 350° к 10° — через 0°, а не назад через весь круг.
 * @param {number} from Направление в начале, радианы.
 * @param {number} to Направление в конце, радианы.
 * @param {number} progress Доля поворота от 0 до 1.
 * @returns {number} Направление, радианы.
 */
export function turned(from: number, to: number, progress: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));

  return from + delta * progress;
}
