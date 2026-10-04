// Подсчёт токенов по транскрипту Claude Code (JSONL). Формат транскрипта внутренний и может
// меняться, поэтому разбор терпимый: непонятные строки пропускаются.
//
// Считаются входные, выходные и записанные в кеш токены. Чтения из кеша не считаются:
// это один и тот же контекст, перечитанный на каждом шаге, и они раздули бы счётчик в разы.

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
}

function usageOf(line: string): { messageId: string; usage: Usage } | null {
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof entry !== "object" || entry === null) return null;
  const message = (entry as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const { id, usage } = message as { id?: unknown; usage?: unknown };
  if (typeof id !== "string" || typeof usage !== "object" || usage === null) return null;
  return { messageId: id, usage: usage as Usage };
}

function tokensOf(usage: Usage): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0)
  );
}

/**
 * Считает токены по транскрипту сессии Claude Code.
 * @param {string} transcript Содержимое транскрипта в формате JSONL.
 * @returns {number} Сумма входных, выходных и записанных в кеш токенов.
 */
export function countTokens(transcript: string): number {
  // Одно сообщение модели встречается в транскрипте несколько раз (по частям ответа) —
  // учитывается последний вариант для каждого id.
  const byMessage = new Map<string, Usage>();
  for (const line of transcript.split("\n")) {
    const parsed = usageOf(line);
    if (parsed !== null) byMessage.set(parsed.messageId, parsed.usage);
  }
  let total = 0;
  for (const usage of byMessage.values()) total += tokensOf(usage);
  return total;
}
