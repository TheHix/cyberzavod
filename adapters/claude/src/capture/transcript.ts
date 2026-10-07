// Токены, модели и тексты по транскрипту Claude Code (JSONL). Формат транскрипта внутренний
// и может меняться, поэтому разбор терпимый: непонятные строки пропускаются.
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

function timestampOf(entry: Record<string, unknown>): number | undefined {
  const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;

  return Number.isNaN(ts) ? undefined : ts;
}

function usageOf(line: string): { messageId: string; usage: Usage; ts?: number } | null {
  const entry = entryOf(line);
  const message = entry?.message;

  if (entry === null || !isObject(message)) return null;

  const { id, usage } = message;

  if (typeof id !== "string" || !isObject(usage)) return null;

  const ts = timestampOf(entry);

  return { messageId: id, usage: usage as Usage, ...(ts === undefined ? {} : { ts }) };
}

function replyOf(line: string): ModelReply | null {
  const entry = entryOf(line);

  if (entry === null || !isObject(entry.message)) return null;

  const { model } = entry.message;

  if (typeof model !== "string" || model.startsWith(SERVICE_MODEL_PREFIX)) return null;

  const ts = timestampOf(entry);

  return ts === undefined ? null : { ts, model };
}

function tokensOf(usage: Usage): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0)
  );
}

/** Токены одного сообщения модели и время, когда оно закончилось. */
export interface TokenUsage {
  ts: number;
  tokens: number;
}

// Одно сообщение модели встречается в транскрипте несколько раз (по частям ответа) —
// учитывается последний вариант для каждого id, а время берётся у последней части с временем.
function messageUsages(transcript: string): { ts?: number; tokens: number }[] {
  const byMessage = new Map<string, { ts?: number; usage: Usage }>();

  for (const line of transcript.split("\n")) {
    const parsed = usageOf(line);

    if (parsed === null) continue;

    const ts = parsed.ts ?? byMessage.get(parsed.messageId)?.ts;

    byMessage.set(parsed.messageId, { usage: parsed.usage, ...(ts === undefined ? {} : { ts }) });
  }

  return [...byMessage.values()].map(({ ts, usage }) => ({
    tokens: tokensOf(usage),
    ...(ts === undefined ? {} : { ts }),
  }));
}

/**
 * Считает токены по транскрипту сессии Claude Code.
 * @param {string} transcript Содержимое транскрипта в формате JSONL.
 * @returns {number} Сумма входных, выходных и записанных в кеш токенов.
 */
export function countTokens(transcript: string): number {
  return messageUsages(transcript).reduce((total, { tokens }) => total + tokens, 0);
}

/**
 * Раскладывает токены транскрипта по сообщениям модели: по ним токены основной сессии
 * делятся между сборками.
 * @param {string} transcript Содержимое транскрипта в формате JSONL.
 * @returns {TokenUsage[]} Токены каждого сообщения по тем же правилам, что у `countTokens`,
 *   от ранних к поздним; сообщения без времени пропускаются.
 */
export function tokenUsages(transcript: string): TokenUsage[] {
  return messageUsages(transcript)
    .flatMap(({ ts, tokens }) => (ts === undefined ? [] : [{ ts, tokens }]))
    .sort((a, b) => a.ts - b.ts);
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

/** Текст модели в транскрипте: когда он сказан и что в нём. */
export interface TranscriptText {
  ts: number;
  text: string;
}

/** Задание сабагенту, выданное сессией: новому запуском (`spawn`) или сообщением (`message`). */
export type AgentAssignment = { ts: number; text: string } & (
  { via: "spawn"; agentType: string; agentId?: string } | { via: "message"; agentId: string }
);

/** Отчёт запуска сабагента: что он сдал сессии, когда и кто это был. */
export interface AgentReport {
  ts: number;
  agentId: string;
  text: string;
}

/** Запись транскрипта, у которой есть сообщение и время. */
interface Entry {
  uuid?: string;
  role: "user" | "assistant";
  ts: number;
  message: Record<string, unknown>;
  agentId?: string;
  /** Результат инструмента: у `Agent` в нём лежит `agentId` запущенного сабагента. */
  toolUseResult?: Record<string, unknown>;
}

const PARAGRAPH_SEPARATOR = "\n\n";
const ASSISTANT_ROLE = "assistant";
const USER_ROLE = "user";
// Начала сообщений среды в роли user: это не новое задание, а служебная вставка.
const SERVICE_ENTRY_PREFIXES: readonly string[] = ["<system-reminder>", "[SYSTEM NOTIFICATION"];
const AGENT_TOOL = "Agent";
const SEND_MESSAGE_TOOL = "SendMessage";
const HANDBACK_TOOL = "SubagentHandback";

function entryOfLine(line: string): Entry | null {
  const entry = entryOf(line);

  if (entry === null || !isObject(entry.message)) return null;

  const role = entry.type;

  if (role !== ASSISTANT_ROLE && role !== USER_ROLE) return null;

  const ts = timestampOf(entry);

  if (ts === undefined) return null;

  return {
    role,
    ts,
    message: entry.message,
    ...(typeof entry.uuid === "string" ? { uuid: entry.uuid } : {}),
    ...(typeof entry.agentId === "string" ? { agentId: entry.agentId } : {}),
    ...(isObject(entry.toolUseResult) ? { toolUseResult: entry.toolUseResult } : {}),
  };
}

// Записи по порядку строк; одна и та же запись (по uuid) может попасть в файл дважды.
function entriesOf(transcript: string): Entry[] {
  const seen = new Set<string>();
  const entries: Entry[] = [];

  for (const line of transcript.split("\n")) {
    const entry = entryOfLine(line);

    if (entry === null) continue;

    const isRepeat = entry.uuid !== undefined && seen.has(entry.uuid);

    if (isRepeat) continue;
    if (entry.uuid !== undefined) seen.add(entry.uuid);

    entries.push(entry);
  }

  return entries;
}

function isModelEntry(entry: Entry): boolean {
  if (entry.role !== ASSISTANT_ROLE) return false;

  const { model } = entry.message;

  return typeof model !== "string" || !model.startsWith(SERVICE_MODEL_PREFIX);
}

function blocksOf(entry: Entry): Record<string, unknown>[] {
  const { content } = entry.message;

  return Array.isArray(content) ? content.filter(isObject) : [];
}

function textPartsOf(entry: Entry): TranscriptText[] {
  const parts: TranscriptText[] = [];

  for (const block of blocksOf(entry)) {
    const { text } = block;

    if (block.type === "text" && typeof text === "string" && text.trim() !== "") {
      parts.push({ ts: entry.ts, text: text.trim() });
    }
  }

  return parts;
}

// Текстовые блоки одного ответа модели приходят отдельными записями с общим message.id:
// ответ — это все его тексты подряд, а время — время последнего из них.
function textsOfEntries(entries: readonly Entry[]): TranscriptText[] {
  const byMessage = new Map<string, TranscriptText[]>();

  entries.forEach((entry, index) => {
    if (!isModelEntry(entry)) return;

    const { id } = entry.message;
    const key = typeof id === "string" ? id : `entry-${index}`;
    const parts = byMessage.get(key) ?? [];

    byMessage.set(key, [...parts, ...textPartsOf(entry)]);
  });

  return [...byMessage.values()]
    .filter((parts) => parts.length > 0)
    .map((parts) => ({
      ts: parts.at(-1)?.ts ?? 0,
      text: parts.map((part) => part.text).join(PARAGRAPH_SEPARATOR),
    }));
}

/**
 * Собирает тексты ответов модели из транскрипта: итоговые ответы человеку берутся отсюда.
 * @param {string} transcript Содержимое транскрипта в формате JSONL.
 * @returns {TranscriptText[]} Ответы модели от ранних к поздним, без служебных.
 */
export function assistantTexts(transcript: string): TranscriptText[] {
  return textsOfEntries(entriesOf(transcript)).sort((a, b) => a.ts - b.ts);
}

function resultCallIdsOf(entry: Entry): string[] {
  return blocksOf(entry).flatMap((block) => {
    const { tool_use_id: callId } = block;

    return block.type === "tool_result" && typeof callId === "string" ? [callId] : [];
  });
}

// Запущенный сабагент узнаётся по результату вызова `Agent`: запись user с блоком
// `tool_result` того же `tool_use_id` и `agentId` в `toolUseResult`.
function agentIdsByCall(entries: readonly Entry[]): Map<string, string> {
  const agentIds = new Map<string, string>();

  for (const entry of entries) {
    const agentId = entry.toolUseResult?.agentId;

    if (entry.role !== USER_ROLE || typeof agentId !== "string") continue;

    for (const callId of resultCallIdsOf(entry)) agentIds.set(callId, agentId);
  }

  return agentIds;
}

function spawnAssignmentOf(
  input: Record<string, unknown>,
  callId: unknown,
  ts: number,
  agentIds: ReadonlyMap<string, string>,
): AgentAssignment | null {
  const { subagent_type: agentType, prompt } = input;

  if (typeof agentType !== "string" || typeof prompt !== "string") return null;

  const agentId = typeof callId === "string" ? agentIds.get(callId) : undefined;

  return {
    ts,
    text: prompt,
    via: "spawn",
    agentType,
    ...(agentId === undefined ? {} : { agentId }),
  };
}

function messageAssignmentOf(input: Record<string, unknown>, ts: number): AgentAssignment | null {
  const { to: agentId, message } = input;

  if (typeof agentId !== "string" || typeof message !== "string") return null;

  return { ts, text: message, via: "message", agentId };
}

function assignmentOf(
  block: Record<string, unknown>,
  ts: number,
  agentIds: ReadonlyMap<string, string>,
): AgentAssignment | null {
  const { name, input, id } = block;

  if (block.type !== "tool_use" || !isObject(input)) return null;
  if (name === AGENT_TOOL) return spawnAssignmentOf(input, id, ts, agentIds);
  if (name === SEND_MESSAGE_TOOL) return messageAssignmentOf(input, ts);

  return null;
}

/**
 * Находит задания, которые сессия выдала сабагентам: вызовы `Agent` и `SendMessage`.
 * @param {string} transcript Содержимое транскрипта сессии в формате JSONL.
 * @returns {AgentAssignment[]} Задания от ранних к поздним; у задания новому запуску есть
 *   `agentId`, если в транскрипте нашёлся результат вызова.
 */
export function agentAssignments(transcript: string): AgentAssignment[] {
  const entries = entriesOf(transcript);
  const agentIds = agentIdsByCall(entries);

  return entries
    .filter(isModelEntry)
    .flatMap((entry) => blocksOf(entry).map((block) => assignmentOf(block, entry.ts, agentIds)))
    .filter((assignment) => assignment !== null)
    .sort((a, b) => a.ts - b.ts);
}

// Запуск сабагента начинается с записи user со строкой — задание или сообщение координатора.
function startsRun(entry: Entry): boolean {
  if (entry.role !== USER_ROLE) return false;

  const { content } = entry.message;

  return typeof content === "string" && !SERVICE_ENTRY_PREFIXES.some((p) => content.startsWith(p));
}

function runsOf(entries: readonly Entry[]): Entry[][] {
  const runs: Entry[][] = [];

  for (const entry of entries) {
    if (startsRun(entry)) runs.push([]);

    runs.at(-1)?.push(entry);
  }

  return runs;
}

function handbackOf(entry: Entry): TranscriptText | null {
  const handbacks = blocksOf(entry).flatMap((block) => {
    const { input } = block;
    const isHandback = block.type === "tool_use" && block.name === HANDBACK_TOOL;

    return isHandback && isObject(input) && typeof input.message === "string"
      ? [{ ts: entry.ts, text: input.message }]
      : [];
  });

  return handbacks.at(-1) ?? null;
}

// Отчёт запуска — последняя сдача работы, а если её не было, последний текст модели.
function reportOfRun(run: readonly Entry[]): TranscriptText | null {
  const handbacks = run.map(handbackOf).filter((handback) => handback !== null);

  const lastText = textsOfEntries(run)
    .sort((a, b) => a.ts - b.ts)
    .at(-1);

  return handbacks.at(-1) ?? lastText ?? null;
}

/**
 * Находит отчёты запусков сабагента в его транскрипте: по одному на запуск.
 * @param {string} transcript Содержимое транскрипта сабагента в формате JSONL.
 * @returns {AgentReport[]} Отчёты от ранних к поздним; запуск без отчёта и записи без
 *   `agentId` пропускаются.
 */
export function agentReports(transcript: string): AgentReport[] {
  return runsOf(entriesOf(transcript))
    .flatMap((run) => {
      const agentId = run.find((entry) => entry.agentId !== undefined)?.agentId;
      const report = reportOfRun(run);

      return agentId === undefined || report === null ? [] : [{ ...report, agentId }];
    })
    .sort((a, b) => a.ts - b.ts);
}
