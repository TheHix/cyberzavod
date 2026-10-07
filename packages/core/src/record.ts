// Записи журнала проекта — один формат для CLI, хранилища и просмотрщика. Запись — конверт
// (кто, когда, в каком проекте) и данные её типа: сессия работы над задачей, решение или
// заметка. Цех на сайте проигрывает сессию по её событиям, поэтому всё, что видно на экране,
// должно выводиться отсюда.

import { isLine, isObject } from "./guards.ts";
import { isStage, type Stage } from "./stage.ts";

/** Версия формата записи. Добавление нового типа записи или события версию не меняет. */
export const RECORD_VERSION = 1;

/**
 * Промпт человека в чистовом виде: главное указание одной строкой и уточнения списком.
 * Как промпт был набран, в запись не попадает — только то, что человек просил.
 */
export interface PromptEvent {
  t: number;
  type: "prompt";
  goal: string;
  requirements: string[];
  /** Модель, которая получила промпт, — id вроде `claude-opus-5-5`; нет, если неизвестна. */
  model?: string;
}

/** Мастер цеха — человек-программист: раздаёт задачи и принимает итог. */
export const FOREMAN = "foreman";

/** Участник разговора в цехе: рабочий станции или мастер. */
export type Speaker = Stage | typeof FOREMAN;

/** Реплика: строка над говорящим в цехе и полный текст для журнала. */
export interface MessageEvent {
  t: number;
  type: "message";
  from: Speaker;
  /** Кому адресована реплика; не совпадает с `from`. */
  to: Speaker;
  /** Одна строка над говорящим в цехе. */
  line: string;
  /** Полный текст: абзацы через пустую строку, без разметки. */
  text: string;
}

/**
 * Что остановило автоматику и позвало человека: ответ на вопрос агента, решение по постановке,
 * вызов после возвратов, вызов хуком остановки. Что решил человек, лежит в `line` и `text`.
 */
export const INTERVENTION_REASONS = [
  "question",
  "plan_review",
  "rework_limit",
  "stop_gate",
] as const;

/** Причина вмешательства человека — одна из `INTERVENTION_REASONS`. */
export type InterventionReason = (typeof INTERVENTION_REASONS)[number];

/**
 * Вмешательство человека: станция стоит до его решения. В цехе мастер выходит к станции,
 * где стоит работа, и говорит решение: строка `line` — в пузыре, полный `text` — в журнале.
 * Идёт вместо промпта, а не рядом с ним.
 */
export interface InterventionEvent {
  t: number;
  type: "intervention";
  reason: InterventionReason;
  /** Одна строка над мастером в цехе: решение человека, обращённое к рабочему. */
  line: string;
  /** Полный текст: абзацы через пустую строку, без разметки. */
  text: string;
}

/** Событие сессии; `t` — миллисекунды от начала сессии (`timestamp` записи). */
export type SessionEvent =
  | { t: number; type: "build_start" }
  | PromptEvent
  | MessageEvent
  | InterventionEvent
  | { t: number; type: "stage_enter"; stage: Stage }
  | { t: number; type: "stage_fail"; stage: Stage; reason: string }
  | { t: number; type: "usage"; tokens: number }
  | { t: number; type: "build_end"; ok: boolean };

/** Кто сделал запись: агент (провайдер и агент из его адаптера) или человек вручную. */
export type RecordSource = { type: "agent"; provider: string; agent: string } | { type: "manual" };

/** Общее у записей всех типов: кто, когда и в каком проекте. */
export interface RecordHeader {
  version: typeof RECORD_VERSION;
  /** Идентификатор записи: он же имя файла и часть адреса страницы. */
  id: string;
  /** Момент записи в ISO 8601 по UTC, как у `Date.prototype.toISOString`; у сессии — её начало. */
  timestamp: string;
  /** Идентификатор проекта: те же правила, что у `id`. */
  projectId: string;
  /** Сессия агента, из которой запись; нет, если неизвестна или запись сделана вручную. */
  sessionId?: string;
  source: RecordSource;
}

/** Данные сессии: задача прошла по этапам процесса, события — то, что проигрывает цех. */
export interface SessionData {
  title: string;
  /**
   * Язык оригинала промптов и реплик — код ISO 639 (`ru`, `en`). Запись не переводится,
   * зритель на другом языке видит её в оригинале с этой пометкой.
   */
  language: string;
  /** Имя процесса из `harness/workflows/`. */
  workflow: string;
  /** Версия harness одной строкой, например `0.3.0`: по ней видно, какие правила работали. */
  harness: string;
  events: SessionEvent[];
}

/** Сессия работы над задачей: её проигрывает цех. */
export interface SessionRecord extends RecordHeader {
  type: "session";
  data: SessionData;
}

/** Решение по проекту: что выбрали и почему. */
export interface DecisionRecord extends RecordHeader {
  type: "decision";
  data: { title: string; description: string };
}

/** Заметка о проекте свободным текстом. */
export interface NoteRecord extends RecordHeader {
  type: "note";
  data: { text: string };
}

/** Запись журнала проекта — размеченное объединение по `type`. */
export type JournalRecord = SessionRecord | DecisionRecord | NoteRecord;

/** Тип записи журнала. */
export type RecordType = JournalRecord["type"];

/** Реплика без полного текста: цеху нужна только строка над говорящим. */
export type BriefMessageEvent = Omit<MessageEvent, "text">;

/** Вмешательство без полного текста: цеху нужна только строка над мастером. */
export type BriefInterventionEvent = Omit<InterventionEvent, "text">;

/** Событие сессии, как его видит цех: у реплик и вмешательств нет полного текста. */
export type BriefSessionEvent =
  | Exclude<SessionEvent, MessageEvent | InterventionEvent>
  | BriefMessageEvent
  | BriefInterventionEvent;

/** Сессия без полных текстов реплик: её получает цех, а полный текст остаётся в журнале. */
export interface BriefSessionRecord extends Omit<SessionRecord, "data"> {
  data: Omit<SessionData, "events"> & { events: BriefSessionEvent[] };
}

/**
 * Счётчики сессии на какой-то момент: токены, промпты человека, возвраты на доработку
 * и вмешательства человека (их промпты не считаются).
 */
export interface Tally {
  tokens: number;
  prompts: number;
  reworks: number;
  interventions: number;
}

/** Счётчики сессии, которые показываются над цехом. */
export interface BuildStats extends Tally {
  durationMs: number;
  ok: boolean;
}

/** Счётчики до первого события. */
export const NO_TALLY: Tally = { tokens: 0, prompts: 0, reworks: 0, interventions: 0 };

/** Ошибка формата записи: запись пришла извне и не прошла проверку. */
export class RecordError extends Error {}

/**
 * Проверяет, что значение — участник разговора в цехе.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is Speaker} true, если это этап или мастер.
 */
export function isSpeaker(value: unknown): value is Speaker {
  return value === FOREMAN || isStage(value);
}

function isInterventionReason(value: unknown): value is InterventionReason {
  return (INTERVENTION_REASONS as readonly unknown[]).includes(value);
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLine);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// id уходит в имя файла и в адрес страницы: только буквы, цифры, `_` и `-`.
const ID_PATTERN = /^[\w-]+$/;

/**
 * Проверяет, что значение годится в идентификаторы записи и проекта.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если это строка из букв, цифр, «_» и «-».
 */
export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/**
 * Проверяет, что значение — версия harness: непустая строка без переводов строки.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если значение можно показать версией в одну строку.
 */
export function isHarnessVersion(value: unknown): value is string {
  return isLine(value);
}

/** Язык записей, опубликованных до поля `language`: тогда все записи были русскими. */
export const LEGACY_SESSION_LANGUAGE = "ru";

// Основной подтег языка BCP 47: двух- или трёхбуквенный код ISO 639 строчными буквами.
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}$/;

/**
 * Проверяет, что значение — код языка записи: `ru`, `en`, `deu`.
 * @param {unknown} value Проверяемое значение.
 * @returns {value is string} true, если это код ISO 639 из двух-трёх строчных латинских букв.
 */
export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && LANGUAGE_CODE_PATTERN.test(value);
}

// Строгое сравнение с toISOString отсекает и другие форматы, и несуществующие дни вроде
// 31 февраля, которые Date.parse молча переносит на март.
function isInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

type Fail = (why: string) => RecordError;

function parsePrompt(raw: Record<string, unknown>, t: number, fail: Fail): PromptEvent {
  const { goal, requirements, model } = raw;
  if (!isLine(goal)) throw fail("goal должен быть непустой строкой без переводов строки");
  if (!isLines(requirements)) {
    throw fail("requirements должны быть списком непустых строк без переводов строки");
  }
  const prompt: PromptEvent = { t, type: "prompt", goal, requirements: [...requirements] };
  if (model === undefined) return prompt;
  if (!isLine(model)) throw fail("model должна быть непустой строкой без переводов строки");
  return { ...prompt, model };
}

function parseMessage(raw: Record<string, unknown>, t: number, fail: Fail): MessageEvent {
  const { from, to, line, text } = raw;
  if (!isSpeaker(from)) throw fail(`неизвестный говорящий ${String(from)}`);
  if (!isSpeaker(to)) throw fail(`неизвестный адресат ${String(to)}`);
  if (from === to) throw fail(`${from} не может говорить сам с собой`);
  if (!isLine(line)) throw fail("line должна быть непустой строкой без переводов строки");
  if (!isText(text)) throw fail("text должен быть непустой строкой");
  return { t, type: "message", from, to, line, text };
}

function parseIntervention(raw: Record<string, unknown>, t: number, fail: Fail): InterventionEvent {
  const { reason, line, text } = raw;
  if (!isInterventionReason(reason)) throw fail(`неизвестная причина ${String(reason)}`);
  if (!isLine(line)) throw fail("line должна быть непустой строкой без переводов строки");
  if (!isText(text)) throw fail("text должен быть непустой строкой");
  return { t, type: "intervention", reason, line, text };
}

/**
 * Проверяет одно событие сессии, пришедшее извне.
 * @param {unknown} raw Разобранный JSON события.
 * @param {number} index Номер события в сессии — для сообщения об ошибке.
 * @returns {SessionEvent} Проверенное событие.
 * @throws {RecordError} Если событие не соответствует формату.
 */
export function parseSessionEvent(raw: unknown, index: number): SessionEvent {
  const fail: Fail = (why) => new RecordError(`событие #${index}: ${why}`);
  if (!isObject(raw)) throw fail("не объект");

  const { t, type } = raw;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0) throw fail("некорректное время t");

  switch (type) {
    case "build_start":
      return { t, type };
    case "prompt":
      return parsePrompt(raw, t, fail);
    case "message":
      return parseMessage(raw, t, fail);
    case "intervention":
      return parseIntervention(raw, t, fail);
    case "stage_enter":
      if (!isStage(raw.stage)) throw fail(`неизвестный этап ${String(raw.stage)}`);
      return { t, type, stage: raw.stage };
    case "stage_fail":
      if (!isStage(raw.stage)) throw fail(`неизвестный этап ${String(raw.stage)}`);
      if (typeof raw.reason !== "string") throw fail("нет reason");
      return { t, type, stage: raw.stage, reason: raw.reason };
    case "usage":
      if (typeof raw.tokens !== "number" || raw.tokens < 0) throw fail("некорректное tokens");
      return { t, type, tokens: raw.tokens };
    case "build_end":
      if (typeof raw.ok !== "boolean") throw fail("нет ok");
      return { t, type, ok: raw.ok };
    default:
      throw fail(`неизвестный тип ${String(type)}`);
  }
}

function parseSource(raw: unknown): RecordSource {
  if (!isObject(raw)) throw new RecordError("source должен быть объектом");
  switch (raw.type) {
    case "manual":
      return { type: "manual" };
    case "agent":
      if (!isLine(raw.provider)) throw new RecordError("у source нет provider");
      if (!isLine(raw.agent)) throw new RecordError("у source нет agent");
      return { type: "agent", provider: raw.provider, agent: raw.agent };
    default:
      throw new RecordError(`неизвестный источник ${String(raw.type)}`);
  }
}

function parseHeader(raw: Record<string, unknown>): RecordHeader {
  if (raw.version !== RECORD_VERSION) {
    throw new RecordError(`неподдерживаемая версия ${String(raw.version)}`);
  }
  if (!isRecordId(raw.id)) throw new RecordError("id должен состоять из букв, цифр, «_» и «-»");
  if (!isRecordId(raw.projectId)) {
    throw new RecordError("projectId должен состоять из букв, цифр, «_» и «-»");
  }
  if (!isInstant(raw.timestamp)) {
    throw new RecordError("timestamp должен быть временем ISO 8601 по UTC, как у toISOString");
  }
  const header: RecordHeader = {
    version: RECORD_VERSION,
    id: raw.id,
    timestamp: raw.timestamp,
    projectId: raw.projectId,
    source: parseSource(raw.source),
  };
  if (raw.sessionId === undefined) return header;
  if (!isLine(raw.sessionId)) throw new RecordError("sessionId должен быть непустой строкой");
  return { ...header, sessionId: raw.sessionId };
}

function parseEvents(raw: unknown): SessionEvent[] {
  if (!Array.isArray(raw)) throw new RecordError("нет events");
  const events = raw.map(parseSessionEvent);
  if (events[0]?.type !== "build_start") {
    throw new RecordError("сессия должна начинаться с build_start");
  }
  if (events.at(-1)?.type !== "build_end") {
    throw new RecordError("сессия должна заканчиваться build_end");
  }
  let prevT = 0;
  events.forEach((event, i) => {
    if (event.t < prevT) throw new RecordError(`событие #${i}: время идёт назад`);
    prevT = event.t;
  });
  return events;
}

function parseSessionData(raw: unknown): SessionData {
  if (!isObject(raw)) throw new RecordError("data должна быть объектом");
  const { title, workflow, harness, language = LEGACY_SESSION_LANGUAGE } = raw;
  if (!isLine(title)) {
    throw new RecordError("title должен быть непустой строкой без переводов строки");
  }
  if (!isLanguageCode(language)) {
    throw new RecordError("language должен быть кодом языка ISO 639: ru, en");
  }
  if (!isLine(workflow)) throw new RecordError("workflow должен быть непустой строкой");
  if (!isHarnessVersion(harness)) {
    throw new RecordError("harness должна быть непустой строкой без переводов строки");
  }
  return { title, language, workflow, harness, events: parseEvents(raw.events) };
}

function parseDecisionData(raw: unknown): DecisionRecord["data"] {
  if (!isObject(raw)) throw new RecordError("data должна быть объектом");
  const { title, description } = raw;
  if (!isLine(title)) {
    throw new RecordError("title должен быть непустой строкой без переводов строки");
  }
  if (typeof description !== "string") throw new RecordError("description должно быть строкой");
  return { title, description };
}

function parseNoteData(raw: unknown): NoteRecord["data"] {
  if (!isObject(raw)) throw new RecordError("data должна быть объектом");
  if (!isText(raw.text)) throw new RecordError("text должен быть непустой строкой");
  return { text: raw.text };
}

/**
 * Проверяет запись журнала, пришедшую извне, и возвращает её типизированной.
 * @param {unknown} raw Разобранный JSON записи.
 * @returns {JournalRecord} Проверенная запись; неизвестные поля отброшены.
 * @throws {RecordError} Если запись не соответствует формату.
 */
export function parseRecord(raw: unknown): JournalRecord {
  if (!isObject(raw)) throw new RecordError("запись должна быть объектом");
  const header = parseHeader(raw);
  switch (raw.type) {
    case "session":
      return { ...header, type: "session", data: parseSessionData(raw.data) };
    case "decision":
      return { ...header, type: "decision", data: parseDecisionData(raw.data) };
    case "note":
      return { ...header, type: "note", data: parseNoteData(raw.data) };
    default:
      throw new RecordError(`неизвестный тип записи ${String(raw.type)}`);
  }
}

/**
 * Добавляет событие сессии к счётчикам.
 * @param {Tally} counts Счётчики до события.
 * @param {BriefSessionEvent} event Событие сессии.
 * @returns {Tally} Счётчики после события.
 */
export function tally(counts: Tally, event: BriefSessionEvent): Tally {
  switch (event.type) {
    case "usage":
      return { ...counts, tokens: counts.tokens + event.tokens };
    case "prompt":
      return { ...counts, prompts: counts.prompts + 1 };
    case "intervention":
      return { ...counts, interventions: counts.interventions + 1 };
    case "stage_fail":
      return { ...counts, reworks: counts.reworks + 1 };
    case "build_start":
    case "stage_enter":
    case "message":
    case "build_end":
      return counts;
    default:
      // Новый тип события не скомпилируется, пока его не учтут здесь.
      return event satisfies never;
  }
}

/**
 * Итог сессии: удалась ли она по последнему событию.
 * @param {BriefSessionRecord} session Проверенная сессия.
 * @returns {boolean} true, если сессия кончается удачным build_end.
 */
export function succeeded(session: BriefSessionRecord): boolean {
  const last = session.data.events.at(-1);
  return last?.type === "build_end" && last.ok;
}

/**
 * Считает счётчики сессии по её событиям.
 * @param {BriefSessionRecord} session Проверенная сессия.
 * @returns {BuildStats} Длительность, токены, число промптов, возвратов и вмешательств, итог.
 */
export function summarize(session: BriefSessionRecord): BuildStats {
  const { events } = session.data;
  return {
    durationMs: (events.at(-1)?.t ?? 0) - (events[0]?.t ?? 0),
    ...events.reduce(tally, NO_TALLY),
    ok: succeeded(session),
  };
}

/**
 * Убирает у реплики полный текст.
 * @param {BriefMessageEvent} event Реплика; на деле может нести и `text`.
 * @returns {BriefMessageEvent} Новая реплика только с полями, которые нужны цеху.
 */
export function briefMessage(event: BriefMessageEvent): BriefMessageEvent {
  const { t, type, from, to, line } = event;
  return { t, type, from, to, line };
}

/**
 * Убирает у вмешательства полный текст.
 * @param {BriefInterventionEvent} event Вмешательство; на деле может нести и `text`.
 * @returns {BriefInterventionEvent} Новое вмешательство только с полями, которые нужны цеху.
 */
export function briefIntervention(event: BriefInterventionEvent): BriefInterventionEvent {
  const { t, type, reason, line } = event;
  return { t, type, reason, line };
}

function briefEvent(event: SessionEvent): BriefSessionEvent {
  switch (event.type) {
    case "message":
      return briefMessage(event);
    case "intervention":
      return briefIntervention(event);
    case "build_start":
    case "prompt":
    case "stage_enter":
    case "stage_fail":
    case "usage":
    case "build_end":
      return event;
    default:
      // Новый тип события не скомпилируется, пока не решат, нужен ли у него полный текст.
      return event satisfies never;
  }
}

/**
 * Убирает у реплик и вмешательств полный текст: цеху он не нужен, а в страницу с цехом
 * попадать не должен.
 * @param {SessionRecord} session Полная сессия.
 * @returns {BriefSessionRecord} Та же сессия, у реплик и вмешательств которой нет `text`.
 */
export function briefOf(session: SessionRecord): BriefSessionRecord {
  return { ...session, data: { ...session.data, events: session.data.events.map(briefEvent) } };
}
