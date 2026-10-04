// Черновик записи: события цеха, где промпты ещё рядом с тем, как их набрал человек.
// Редактор заполняет заголовок и чистовую версию каждого промпта, человек проверяет,
// публикация убирает исходный текст и пропускает запись через проверку ядра.

import {
  parseFactoryEvent,
  parseRecording,
  type FactoryEvent,
  type Recording,
  type RecordingError,
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
}

/** Событие черновика: событие записи или промпт, ещё не прошедший публикацию. */
export type DraftEvent = FactoryEvent | DraftPrompt;

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
  const { t, said, goal, requirements, model } = raw;
  if (typeof t !== "number" || typeof said !== "string" || typeof goal !== "string") {
    throw new DraftError(`событие #${index}: у промпта должны быть t, said и goal`);
  }
  if (!isStrings(requirements)) {
    throw new DraftError(`событие #${index}: requirements должны быть списком строк`);
  }
  const prompt: DraftPrompt = {
    t,
    type: "draft_prompt",
    said,
    goal,
    requirements: [...requirements],
  };
  if (model === undefined) return prompt;
  if (typeof model !== "string") {
    throw new DraftError(`событие #${index}: model должна быть строкой`);
  }
  return { ...prompt, model };
}

function parseDraftEvent(raw: unknown, index: number): DraftEvent {
  if (isObject(raw) && raw.type === "draft_prompt") return parseDraftPrompt(raw, index);
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

// Промпт пересобранного черновика узнаётся по времени и исходному тексту: у той же сессии
// они не меняются, а новый промпт ни с чем не совпадёт.
function samePrompt(a: DraftPrompt, b: DraftPrompt): boolean {
  return a.t === b.t && a.said === b.said;
}

function promptsOf(draft: Draft): DraftPrompt[] {
  return draft.events.filter((event) => event.type === "draft_prompt");
}

// Отредактированным считается промпт, в котором заполнено хоть что-то из чистовой версии.
function editedPromptsOf(draft: Draft): DraftPrompt[] {
  return promptsOf(draft).filter((prompt) => prompt.goal !== "" || prompt.requirements.length > 0);
}

/**
 * Переносит редактуру из прошлого черновика той же сессии в пересобранный.
 * Новые промпты остаются пустыми.
 * @param {Draft} previous Прошлый черновик с уже сделанной редактурой.
 * @param {Draft} next Черновик, только что собранный из журнала.
 * @returns {Draft} Пересобранный черновик с перенесённой редактурой.
 */
export function carryOverEdits(previous: Draft, next: Draft): Draft {
  const edited = editedPromptsOf(previous);
  const events = next.events.map((event): DraftEvent => {
    if (event.type !== "draft_prompt") return event;
    const earlier = edited.find((prompt) => samePrompt(prompt, event));
    if (earlier === undefined) return event;
    // Старые транскрипты Claude Code удаляет: найденная раньше модель не должна пропасть.
    const model = event.model ?? earlier.model;
    return {
      ...event,
      goal: earlier.goal,
      requirements: [...earlier.requirements],
      ...(model === undefined ? {} : { model }),
    };
  });
  return { ...next, title: previous.title, events };
}

/**
 * Находит редактуру прошлого черновика, которую не к чему перенести: такого промпта
 * в пересобранном черновике нет, например исходный текст поправили руками.
 * @param {Draft} previous Прошлый черновик с уже сделанной редактурой.
 * @param {Draft} next Черновик, только что собранный из журнала.
 * @returns {DraftPrompt[]} Отредактированные промпты прошлого черновика без пары.
 */
export function orphanedEdits(previous: Draft, next: Draft): DraftPrompt[] {
  const nextPrompts = promptsOf(next);
  return editedPromptsOf(previous).filter(
    (prompt) => !nextPrompts.some((candidate) => samePrompt(prompt, candidate)),
  );
}

function toPublishedEvent(event: DraftEvent): FactoryEvent {
  if (event.type !== "draft_prompt") return event;
  const { t, goal, requirements, model } = event;
  return { t, type: "prompt", goal, requirements, ...(model === undefined ? {} : { model }) };
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
 * Превращает отредактированный черновик в запись для сайта: без исходных текстов промптов.
 * @param {Draft} draft Черновик с заполненными заголовком и чистовыми версиями промптов.
 * @returns {Recording} Запись, прошедшая проверку формата ядра.
 * @throws {RecordingError} Если заголовок или чистовая версия промпта пусты или запись
 *   не соответствует формату ядра.
 * @throws {DraftError} Если в тексте для публикации похоже на адрес, ключ или личный путь.
 */
export function publishDraft(draft: Draft): Recording {
  const recording = parseRecording({
    version: 1,
    id: draft.id,
    startedAt: draft.startedAt,
    title: draft.title,
    events: draft.events.map(toPublishedEvent),
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
