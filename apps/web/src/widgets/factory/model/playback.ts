// Проигрывание сцены: где мы, идём ли и с какой скоростью. Чистые функции — их применяет
// модель цеха (factory.ts), а часы с requestAnimationFrame живут в ui/frame-clock.ts.

/** Скорости проигрывания на выбор. */
export const SPEEDS = [1, 2, 4] as const;

/** Скорость проигрывания. */
export type Speed = (typeof SPEEDS)[number];

/** Состояние проигрывания: момент сцены в мс, её длина, идёт ли и с какой скоростью. */
export interface Playback {
  readonly position: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly speed: Speed;
}

/**
 * Начинает проигрывание сцены с начала.
 * @param {number} duration Длительность сцены, мс.
 * @param {boolean} playing Идёт ли сразу.
 * @returns {Playback} Состояние в начале сцены.
 */
export function startPlayback(duration: number, playing: boolean): Playback {
  return { position: 0, duration, playing, speed: SPEEDS[0] };
}

/**
 * Сдвигает проигрывание на прошедшее время; в конце сцены останавливается.
 * @param {Playback} playback Текущее состояние.
 * @param {number} elapsedMs Сколько мс прошло с прошлого кадра.
 * @returns {Playback} Состояние после сдвига.
 */
export function advance(playback: Playback, elapsedMs: number): Playback {
  if (!playback.playing) return playback;
  const position = Math.min(playback.duration, playback.position + elapsedMs * playback.speed);
  return { ...playback, position, playing: position < playback.duration };
}

/**
 * Перематывает в момент сцены.
 * @param {Playback} playback Текущее состояние.
 * @param {number} position Момент сцены, мс; вне сцены прижимается к её границам.
 * @returns {Playback} Состояние в новом моменте.
 */
export function seek(playback: Playback, position: number): Playback {
  return { ...playback, position: Math.min(playback.duration, Math.max(0, position)) };
}

/**
 * Переносит проигрывание в сцену другой длины: идёт ли и скорость остаются прежними.
 * @param {Playback} playback Текущее состояние.
 * @param {number} duration Длительность новой сцены, мс.
 * @param {number} position Момент в новой сцене, мс; вне сцены прижимается к её границам.
 * @returns {Playback} То же проигрывание в новой сцене.
 */
export function withDuration(playback: Playback, duration: number, position: number): Playback {
  return seek({ ...playback, duration }, position);
}

/**
 * Ставит на паузу или продолжает; досмотренную сцену запускает с начала.
 * @param {Playback} playback Текущее состояние.
 * @returns {Playback} Состояние после переключения.
 */
export function togglePlaying(playback: Playback): Playback {
  if (playback.playing) return { ...playback, playing: false };
  const atEnd = playback.position >= playback.duration;
  return { ...playback, position: atEnd ? 0 : playback.position, playing: true };
}

/**
 * Узнаёт скорость по её записи — как её отдают переключатели интерфейса.
 * @param {string} value Запись скорости: `"2"`.
 * @returns {Speed | undefined} Скорость или undefined, если такой нет среди SPEEDS.
 */
export function speedFrom(value: string): Speed | undefined {
  return SPEEDS.find((speed) => `${speed}` === value);
}
