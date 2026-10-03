// Форматирование чисел для счётчиков. Без зависимостей, чтобы тестироваться через node --test.

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} с`;
  return `${minutes} мин ${String(seconds).padStart(2, "0")} с`;
}

const tokenFormatter = new Intl.NumberFormat("ru-RU");

export function formatTokens(tokens: number): string {
  return tokenFormatter.format(tokens);
}
