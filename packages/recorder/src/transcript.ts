// Токены и модели по транскрипту Claude Code (JSONL). Формат транскрипта внутренний и может
// меняться, поэтому разбор терпимый: непонятные строки пропускаются.
//
// Считаются входные, выходные и записанные в кеш токены. Чтения из кеша не считаются:
// это один и тот же контекст, перечитанный на каждом шаге, и они раздули бы счётчик в разы.

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Ответ модели в транскрипте: когда и какая модель ответила. */
export interface ModelReply {
  ts: number;
  model: string;
}

// Служебные ответы Claude Code (например, о лимите сессии) помечены моделью `<synthetic>`.
const SERVICE_MODEL_PREFIX = "<";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function entryOf(line: string): Record<string, unknown> | null {
  try {
    const entry: unknown = JSON.parse(line);
    return isObject(entry) ? entry : null;
  } catch {
    return null;
  }
}

function usageOf(line: string): { messageId: string; usage: Usage } | null {
  const message = entryOf(line)?.message;
  if (!isObject(message)) return null;
  const { id, usage } = message;
  if (typeof id !== "string" || !isObject(usage)) return null;
  return { messageId: id, usage: usage as Usage };
}

function replyOf(line: string): ModelReply | null {
  const entry = entryOf(line);
  if (entry === null || !isObject(entry.message)) return null;
  const { model } = entry.message;
  if (typeof model !== "string" || model.startsWith(SERVICE_MODEL_PREFIX)) return null;
  const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isNaN(ts) ? null : { ts, model };
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

/**
 * Собирает ответы моделей из транскрипта по времени: по ним видно, какая модель получила промпт.
 * @param {string} transcript Содержимое транскрипта в формате JSONL.
 * @returns {ModelReply[]} Ответы моделей от ранних к поздним, без служебных.
 */
export function modelReplies(transcript: string): ModelReply[] {
  return transcript
    .split("\n")
    .map(replyOf)
    .filter((reply) => reply !== null)
    .sort((a, b) => a.ts - b.ts);
}
