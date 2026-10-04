// Форматирование чисел для счётчиков над цехом.

/**
 * Форматирует длительность для счётчика: секунды или минуты с секундами.
 * @param {number} ms Длительность в миллисекундах.
 * @returns {string} Строка вида «42 с» или «2 мин 05 с».
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} с`;
  return `${minutes} мин ${String(seconds).padStart(2, "0")} с`;
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
