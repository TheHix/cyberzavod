// Форматирование чисел, времени и дат для страниц записей и счётчиков над цехом.

const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_MINUTES = 60;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Форматирует длительность для счётчика: секунды, минуты с секундами или часы с минутами.
 * @param {number} ms Длительность в миллисекундах.
 * @returns {string} Строка вида «42 с», «2 мин 05 с» или «1 ч 05 мин».
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / SECOND_MS);
  const totalMinutes = Math.floor(totalSeconds / MINUTE_SECONDS);
  const hours = Math.floor(totalMinutes / HOUR_MINUTES);
  if (hours > 0) return `${hours} ч ${twoDigits(totalMinutes % HOUR_MINUTES)} мин`;
  if (totalMinutes > 0) return `${totalMinutes} мин ${twoDigits(totalSeconds % MINUTE_SECONDS)} с`;
  return `${totalSeconds} с`;
}

/**
 * Форматирует момент сборки от её начала, как время на шкале проигрывателя.
 * @param {number} ms Миллисекунды от начала сборки.
 * @returns {string} Строка вида «2:05» или «1:02:05».
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / SECOND_MS);
  const totalMinutes = Math.floor(totalSeconds / MINUTE_SECONDS);
  const hours = Math.floor(totalMinutes / HOUR_MINUTES);
  const seconds = twoDigits(totalSeconds % MINUTE_SECONDS);
  if (hours === 0) return `${totalMinutes}:${seconds}`;
  return `${hours}:${twoDigits(totalMinutes % HOUR_MINUTES)}:${seconds}`;
}

const tokenFormatter = new Intl.NumberFormat("ru-RU");

/**
 * Форматирует число токенов с разбиением по разрядам.
 * @param {number} tokens Число токенов.
 * @returns {string} Строка вида «1 234 567».
 */
export function formatTokens(tokens: number): string {
  return tokenFormatter.format(tokens);
}

// Страницы собираются заранее, без часового пояса зрителя, поэтому день — по UTC, как и в id записи.
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Форматирует день начала записи для подписи.
 * @param {string} startedAt Время в ISO 8601: `2026-10-04T09:52:13.000Z`.
 * @returns {string} Строка вида «4 октября 2026 г.».
 */
export function formatDate(startedAt: string): string {
  return dateFormatter.format(new Date(startedAt));
}
