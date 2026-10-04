// Черновик записи: события цеха, где промпты ещё рядом с тем, как их набрал человек.
// Редактор заполняет заголовок и чистовую версию каждого промпта, человек проверяет,
// публикация убирает исходный текст и пропускает запись через проверку ядра.

import {
  isSpeaker,
  parseFactoryEvent,
  parseRecording,
  type FactoryEvent,
  type Recording,
  type RecordingError,
  type Speaker,
} from "@cyberzavod/core";
import { findLeaks } from "./leaks.ts";

/** Промпт в черновике: исходный текст человека и чистовая версия для публикации. */
export interface DraftPrompt {
  t: number;
  type: "draft_prompt";
  said: string;
  goal: string;
  requirements: string[];
  /** Модель, которая получила промпт; её определяет сборка черновика, а не редактор. */
  model?: string;
  /**
   * Промпт склеен с предыдущим: это «да» или «продолжай», смысл которых редактор вписал
   * в тот промпт. В запись такой промпт не идёт.
   */
  joined?: boolean;
}

const MESSAGE_SOURCES = ["assignment", "report", "answer"] as const;

/**
 * Откуда в сессии взялась реплика: задание станции, отчёт станции или итоговый ответ человеку.
 * Это подсказка редактору, как писать `line`; на сайт она не идёт.
 */
export type MessageSource = (typeof MESSAGE_SOURCES)[number];

function isMessageSource(value: unknown): value is MessageSource {
  return (MESSAGE_SOURCES as readonly unknown[]).includes(value);
}

/**
 * Реплика в черновике: кто и кому сказал, исходный текст и чистовая версия для публикации.
 * Участников, `source` и текст `said` определяет сборка черновика, `line` и `text` пишет редактор.
 */
export interface DraftMessage {
  t: number;
  type: "draft_message";
  from: Speaker;
  to: Speaker;
  source: MessageSource;
  said: string;
  line: string;
  text: string;
}

/** Событие черновика: событие записи, промпт или реплика, ещё не прошедшие публикацию. */
export type DraftEvent = FactoryEvent | DraftPrompt | DraftMessage;

/** Событие черновика, которое правит редактор: промпт или реплика. */
export type EditableDraftEvent = DraftPrompt | DraftMessage;

/** Черновик записи сборки: собирается из журнала, редактируется и публикуется. */
export interface Draft {
  id: string;
  startedAt: string;
  title: string;
  events: DraftEvent[];
}

/** Ошибка черновика: файл повреждён или текст для публикации не прошёл проверку. */
export class DraftError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDraftPrompt(raw: Record<string, unknown>, index: number): DraftPrompt {
  const { t, said, goal, requirements, model, joined } = raw;
  if (typeof t !== "number" || typeof said !== "string" || typeof goal !== "string") {
    throw new DraftError(`событие #${index}: у промпта должны быть t, said и goal`);
  }
  if (!isStrings(requirements)) {
    throw new DraftError(`событие #${index}: requirements должны быть списком строк`);
  }
  if (model !== undefined && typeof model !== "string") {
    throw new DraftError(`событие #${index}: model должна быть строкой`);
  }
  if (joined !== undefined && typeof joined !== "boolean") {
    throw new DraftError(`событие #${index}: joined должно быть true или false`);
  }
  return {
    t,
    type: "draft_prompt",
    said,
    goal,
    requirements: [...requirements],
    ...(model === undefined ? {} : { model }),
    ...(joined === undefined ? {} : { joined }),
  };
}

function parseDraftMessage(raw: Record<string, unknown>, index: number): DraftMessage {
  const { t, from, to, source, said, line, text } = raw;
  if (typeof t !== "number" || typeof said !== "string") {
    throw new DraftError(`событие #${index}: у реплики должны быть t и said`);
  }
  if (!isSpeaker(from) || !isSpeaker(to)) {
    throw new DraftError(`событие #${index}: у реплики должны быть from и to`);
  }
  if (!isMessageSource(source)) {
    throw new DraftError(`событие #${index}: неизвестный source ${String(source)}`);
  }
  if (typeof line !== "string" || typeof text !== "string") {
    throw new DraftError(`событие #${index}: line и text реплики должны быть строками`);
  }
  return { t, type: "draft_message", from, to, source, said, line, text };
}

function parseDraftEvent(raw: unknown, index: number): DraftEvent {
  if (isObject(raw) && raw.type === "draft_prompt") return parseDraftPrompt(raw, index);
  if (isObject(raw) && raw.type === "draft_message") return parseDraftMessage(raw, index);
  return parseFactoryEvent(raw, index);
}

/**
 * Проверяет черновик, прочитанный из файла: его правил редактор, поэтому доверять ему нельзя.
 * Чистовые версии промптов могут быть ещё пустыми — их проверяет публикация.
 * @param {unknown} raw Разобранный JSON черновика.
 * @returns {Draft} Проверенный черновик.
 * @throws {DraftError} Если поля черновика или его промптов не того типа.
 * @throws {RecordingError} Если событие цеха в черновике не соответствует формату ядра.
 */
export function parseDraft(raw: unknown): Draft {
  if (!isObject(raw)) throw new DraftError("черновик должен быть объектом");
  const { id, startedAt, title, events } = raw;
  if (typeof id !== "string" || typeof startedAt !== "string" || typeof title !== "string") {
    throw new DraftError("у черновика должны быть id, startedAt и title");
  }
  if (!Array.isArray(events)) throw new DraftError("у черновика нет events");
  return { id, startedAt, title, events: events.map(parseDraftEvent) };
}

// Правка пересобранного черновика узнаётся по времени и исходному тексту: у той же сессии
// они не меняются, а новое событие ни с чем не совпадёт.
function sameSaid(a: EditableDraftEvent, b: EditableDraftEvent): boolean {
  return a.type === b.type && a.t === b.t && a.said === b.said;
}

function editableEventsOf(draft: Draft): EditableDraftEvent[] {
  return draft.events.filter(
    (event) => event.type === "draft_prompt" || event.type === "draft_message",
  );
}

// Отредактированным считается промпт, в котором заполнено хоть что-то из чистовой версии
// или который склеен с предыдущим, и реплика с заполненной строкой или текстом.
function isEdited(event: EditableDraftEvent): boolean {
  switch (event.type) {
    case "draft_prompt":
      return event.goal !== "" || event.requirements.length > 0 || event.joined === true;
    case "draft_message":
      return event.line !== "" || event.text !== "";
    default:
      return event satisfies never;
  }
}

function editedEventsOf(draft: Draft): EditableDraftEvent[] {
  return editableEventsOf(draft).filter(isEdited);
}

function carryOverPrompt(earlier: DraftPrompt, fresh: DraftPrompt): DraftPrompt {
  // Старые транскрипты Claude Code удаляет: найденная раньше модель не должна пропасть.
  const model = fresh.model ?? earlier.model;
  return {
    ...fresh,
    goal: earlier.goal,
    requirements: [...earlier.requirements],
    ...(model === undefined ? {} : { model }),
    ...(earlier.joined === undefined ? {} : { joined: earlier.joined }),
  };
}

function carryOverMessage(earlier: DraftMessage, fresh: DraftMessage): DraftMessage {
  return { ...fresh, line: earlier.line, text: earlier.text };
}

function carryOverEvent(event: DraftEvent, edited: readonly EditableDraftEvent[]): DraftEvent {
  if (event.type !== "draft_prompt" && event.type !== "draft_message") return event;
  const earlier = edited.find((candidate) => sameSaid(candidate, event));
  if (earlier === undefined) return event;
  // sameSaid проверил, что типы совпадают, а сузить пару через него компилятор не может.
  if (event.type === "draft_prompt" && earlier.type === "draft_prompt") {
    return carryOverPrompt(earlier, event);
  }
  if (event.type === "draft_message" && earlier.type === "draft_message") {
    return carryOverMessage(earlier, event);
  }
  return event;
}

/**
 * Переносит редактуру из прошлого черновика той же сессии в пересобранный: чистовые промпты,
 * пометки «склеен» и реплики. Новые промпты и реплики остаются пустыми.
 * @param {Draft} previous Прошлый черновик с уже сделанной редактурой.
 * @param {Draft} next Черновик, только что собранный из журнала.
 * @returns {Draft} Пересобранный черновик с перенесённой редактурой.
 */
export function carryOverEdits(previous: Draft, next: Draft): Draft {
  const edited = editedEventsOf(previous);
  const events = next.events.map((event) => carryOverEvent(event, edited));
  return { ...next, title: previous.title, events };
}

/**
 * Находит редактуру прошлого черновика, которую не к чему перенести: такого промпта или
 * реплики в пересобранном черновике нет, например исходный текст поправили руками.
 * @param {Draft} previous Прошлый черновик с уже сделанной редактурой.
 * @param {Draft} next Черновик, только что собранный из журнала.
 * @returns {EditableDraftEvent[]} Отредактированные промпты и реплики прошлого черновика
 *   без пары.
 */
export function orphanedEdits(previous: Draft, next: Draft): EditableDraftEvent[] {
  const nextEvents = editableEventsOf(next);
  return editedEventsOf(previous).filter(
    (event) => !nextEvents.some((candidate) => sameSaid(event, candidate)),
  );
}

function toPublishedPrompt(prompt: DraftPrompt): FactoryEvent {
  const { t, goal, requirements, model } = prompt;
  return { t, type: "prompt", goal, requirements, ...(model === undefined ? {} : { model }) };
}

function toPublishedMessage(message: DraftMessage): FactoryEvent {
  const { t, from, to, line, text } = message;
  return { t, type: "message", from, to, line, text };
}

// Склеенный промпт вошёл в предыдущий несклеенный, поэтому без него ему некуда войти.
function toPublishedEvents(events: readonly DraftEvent[]): FactoryEvent[] {
  const published: FactoryEvent[] = [];
  let hasPrompt = false;
  events.forEach((event, index) => {
    switch (event.type) {
      case "draft_prompt":
        if (event.joined !== true) {
          hasPrompt = true;
          published.push(toPublishedPrompt(event));
        } else if (!hasPrompt) {
          throw new DraftError(`событие #${index}: склеенному промпту нет предыдущего промпта`);
        }
        return;
      case "draft_message":
        published.push(toPublishedMessage(event));
        return;
      default:
        published.push(event);
    }
  });
  return published;
}

function textsOf(event: FactoryEvent): string[] {
  switch (event.type) {
    case "prompt":
      return [
        event.goal,
        ...event.requirements,
        ...(event.model === undefined ? [] : [event.model]),
      ];
    case "stage_fail":
      return [event.reason];
    case "message":
      return [event.line, event.text];
    case "build_start":
    case "stage_enter":
    case "usage":
    case "build_end":
      return [];
    default:
      // Новый тип события не скомпилируется, пока здесь не решат, есть ли в нём текст для сайта.
      return event satisfies never;
  }
}

/**
 * Превращает отредактированный черновик в запись для сайта: без исходных текстов промптов
 * и реплик, без склеенных промптов.
 * @param {Draft} draft Черновик с заполненными заголовком, чистовыми промптами и репликами.
 * @returns {Recording} Запись, прошедшая проверку формата ядра.
 * @throws {RecordingError} Если заголовок, чистовой промпт или реплика пусты или запись
 *   не соответствует формату ядра.
 * @throws {DraftError} Если склеенный промпт стоит без предыдущего несклеенного или в тексте
 *   для публикации похоже на адрес, ключ или личный путь.
 */
export function publishDraft(draft: Draft): Recording {
  const recording = parseRecording({
    version: 1,
    id: draft.id,
    startedAt: draft.startedAt,
    title: draft.title,
    events: toPublishedEvents(draft.events),
  });

  const texts = [recording.title, ...recording.events.flatMap(textsOf)];
  const leaks = texts.flatMap((text) => findLeaks(text).map((kind) => `${kind} в «${text}»`));
  if (leaks.length > 0) {
    throw new DraftError(
      `в тексте для публикации есть то, что нельзя показывать: ${leaks.join("; ")}`,
    );
  }
  return recording;
}
