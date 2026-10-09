// Черновик записи: события цеха, где промпты ещё рядом с тем, как их набрал человек.
// Редактор заполняет заголовок и чистовую версию каждого промпта, человек проверяет,
// публикация убирает исходный текст и пропускает запись через проверку ядра.

import {
  INTERVENTION_REASONS,
  isRecordId,
  isSpeaker,
  parseSessionEvent,
  parseRecord,
  RECORD_VERSION,
  type RecordSource,
  type SessionEvent,
  type InterventionEvent,
  type InterventionReason,
  type SessionRecord,
  type RecordError,
  type Speaker,
  type Stage,
} from "@cyberzavod/core";
import { ClaudeError } from "../errors.ts";
import { buildTimeline, eventBuilds } from "./builds.ts";
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
  /**
   * Сборка, с которой начинается задача этого промпта. Её ставит редактор; без неё промпт
   * остаётся в сборке ближайшего предыдущего события.
   */
  build?: string;
}

const MESSAGE_SOURCES = ["assignment", "report", "answer"] as const;

/**
 * Откуда в сессии взялась реплика: задание станции, отчёт станции или итоговый ответ человеку.
 * Это подсказка редактору, как писать `line`; на сайт она не идёт.
 */
export type MessageSource = (typeof MESSAGE_SOURCES)[number];

function isInterventionReason(value: unknown): value is InterventionReason {
  return (INTERVENTION_REASONS as readonly unknown[]).includes(value);
}

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
  /** Запуск станции, чьё задание или отчёт это; определяет сборка черновика. */
  run?: string;
  /** Сборка, к которой редактор отнёс реплику вместо наследуемой; перекрывает `run`. */
  build?: string;
}

/**
 * Вмешательство человека в черновике: исходный текст, из которого редактор пишет строку для
 * цеха и полный текст журнала. Причину ставит сборка черновика, редактор её не меняет.
 */
export interface DraftIntervention {
  t: number;
  type: "draft_intervention";
  reason: InterventionReason;
  said: string;
  line: string;
  text: string;
  /** Сборка, к которой редактор отнёс вмешательство вместо наследуемой. */
  build?: string;
}

/**
 * Окно запуска станции: от старта сабагента до его остановки, а если остановки не было —
 * до конца журнала. Нужно, чтобы не сжимать долгую работу станции без событий внутри.
 */
export interface DraftRun {
  t: number;
  type: "draft_run";
  /** Идентификатор запуска (`agentId` сабагента): по нему запуск указывают в `runs` сборки. */
  run: string;
  agent: string;
  until: number;
}

/** Исход проверок: вердикт станции или запуск проверок в основной сессии. */
export interface DraftCheck {
  t: number;
  type: "draft_check";
  ok: boolean;
  /** Запуск станции, вынесший вердикт; у проверок основной сессии его нет. */
  run?: string;
  /** Проект, в чьём каталоге шли проверки основной сессии; `cyberzavod draft` ставит его. */
  project?: string;
}

/**
 * Событие черновика: событие записи (у событий станций с пометкой запуска `run`, у событий
 * основной сессии, чей проект известен, — с пометкой `project`), промпт, реплика, окно запуска
 * или исход проверок, ещё не прошедшие публикацию.
 */
export type DraftEvent =
  | (SessionEvent & { run?: string; project?: string })
  | DraftPrompt
  | DraftMessage
  | DraftIntervention
  | DraftRun
  | DraftCheck;

/** Событие черновика, которое правит редактор: промпт, реплика или вмешательство. */
export type EditableDraftEvent = DraftPrompt | DraftMessage | DraftIntervention;

/**
 * Сборка в черновике: одна будущая запись. Сессия может нести несколько задач, и тогда
 * каждая публикуется отдельной записью со своими проектом, версией harness и заголовком.
 */
export interface DraftBuild {
  /** Идентификатор записи: у первой сборки это `id` черновика. */
  id: string;
  /** Идентификатор проекта; пустая строка — ждёт редактуры, как `title`. */
  project: string;
  /** Версия harness на момент сборки; пустая строка — ждёт редактуры, как `title`. */
  harness: string;
  /** Процесс разработки сборки; пустая строка — ждёт редактуры, как `title`. */
  workflow: string;
  title: string;
  /**
   * Язык промптов и реплик сборки — код ISO 639 (`ru`, `en`); пустая строка — ждёт редактуры,
   * как `title`.
   */
  language: string;
  /** Запуски станций (`agentId`), которые принадлежат сборке. */
  runs: string[];
}

/** Черновик записей сессии: собирается из журнала, редактируется и публикуется. */
export interface Draft {
  id: string;
  startedAt: string;
  /** Сборки сессии; не пуста: первая сборка получает всё, что не отнесено к другим. */
  builds: DraftBuild[];
  events: DraftEvent[];
}

/** Ошибка черновика: файл повреждён или не годится для публикации. */
export class DraftError extends Error {}

// Поля шапки сборки, которые заполняет редактор, если журнал их не принёс. Названия для людей
// лежат в каталоге сообщений.
const HEADER_FIELDS = [
  "title",
  "language",
  "project",
  "harness",
  "workflow",
] as const satisfies readonly (keyof DraftBuild)[];

/** Поле шапки сборки, которое заполняет редактор. */
export type HeaderField = (typeof HEADER_FIELDS)[number];

/** Сборка, у которой в шапке остались незаполненные поля. */
export interface UnfilledBuild {
  buildId: string;
  /** Пустые поля по порядку шапки. */
  fields: HeaderField[];
}

// Записи этого адаптера пишет Claude Code — агент Anthropic.
const CLAUDE_SOURCE: RecordSource = { type: "agent", provider: "anthropic", agent: "claude" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDraftPrompt(raw: Record<string, unknown>, index: number): DraftPrompt {
  const { t, said, goal, requirements, model, joined, build } = raw;

  if (typeof t !== "number" || typeof said !== "string" || typeof goal !== "string") {
    throw new DraftError(`event #${index}: a prompt must have t, said and goal`);
  }
  if (!isStrings(requirements)) {
    throw new DraftError(`event #${index}: requirements must be a list of strings`);
  }
  if (model !== undefined && typeof model !== "string") {
    throw new DraftError(`event #${index}: model must be a string`);
  }
  if (joined !== undefined && typeof joined !== "boolean") {
    throw new DraftError(`event #${index}: joined must be true or false`);
  }
  if (build !== undefined && typeof build !== "string") {
    throw new DraftError(`event #${index}: build must be a string`);
  }

  return {
    t,
    type: "draft_prompt",
    said,
    goal,
    requirements: [...requirements],
    ...(model === undefined ? {} : { model }),
    ...(joined === undefined ? {} : { joined }),
    ...(build === undefined ? {} : { build }),
  };
}

function parseDraftMessage(raw: Record<string, unknown>, index: number): DraftMessage {
  const { t, from, to, source, said, line, text, run, build } = raw;

  if (typeof t !== "number" || typeof said !== "string") {
    throw new DraftError(`event #${index}: a message must have t and said`);
  }
  if (!isSpeaker(from) || !isSpeaker(to)) {
    throw new DraftError(`event #${index}: a message must have from and to`);
  }
  if (!isMessageSource(source)) {
    throw new DraftError(`event #${index}: unknown source ${String(source)}`);
  }
  if (typeof line !== "string" || typeof text !== "string") {
    throw new DraftError(`event #${index}: message line and text must be strings`);
  }
  if (run !== undefined && typeof run !== "string") {
    throw new DraftError(`event #${index}: run must be a string`);
  }
  if (build !== undefined && typeof build !== "string") {
    throw new DraftError(`event #${index}: build must be a string`);
  }

  return {
    t,
    type: "draft_message",
    from,
    to,
    source,
    said,
    line,
    text,
    ...(run === undefined ? {} : { run }),
    ...(build === undefined ? {} : { build }),
  };
}

function parseDraftIntervention(raw: Record<string, unknown>, index: number): DraftIntervention {
  const { t, reason, said, line, text, build } = raw;

  if (typeof t !== "number" || typeof said !== "string") {
    throw new DraftError(`event #${index}: an intervention must have t and said`);
  }
  if (!isInterventionReason(reason)) {
    throw new DraftError(`event #${index}: unknown reason ${String(reason)}`);
  }
  if (typeof line !== "string" || typeof text !== "string") {
    throw new DraftError(`event #${index}: intervention line and text must be strings`);
  }
  if (build !== undefined && typeof build !== "string") {
    throw new DraftError(`event #${index}: build must be a string`);
  }

  return {
    t,
    type: "draft_intervention",
    reason,
    said,
    line,
    text,
    ...(build === undefined ? {} : { build }),
  };
}

function parseDraftRun(raw: Record<string, unknown>, index: number): DraftRun {
  const { t, run, agent, until } = raw;

  if (typeof t !== "number" || typeof run !== "string" || typeof agent !== "string") {
    throw new DraftError(`event #${index}: a run must have t, run and agent`);
  }
  if (typeof until !== "number") {
    throw new DraftError(`event #${index}: run until must be a number`);
  }

  return { t, type: "draft_run", run, agent, until };
}

function parseDraftCheck(raw: Record<string, unknown>, index: number): DraftCheck {
  const { t, ok } = raw;

  if (typeof t !== "number" || typeof ok !== "boolean") {
    throw new DraftError(`event #${index}: a check must have t and ok`);
  }

  return { t, type: "draft_check", ok, ...parseEventMarks(raw, index) };
}

// Событие цеха проходит проверку ядра, которая оставляет только поля формата, поэтому
// пометки черновика — запуск `run` и проект `project` — читаем отдельно.
function parseEventMarks(raw: unknown, index: number): { run?: string; project?: string } {
  const { run, project } = isObject(raw) ? raw : { run: undefined, project: undefined };

  if (run !== undefined && typeof run !== "string") {
    throw new DraftError(`event #${index}: run must be a string`);
  }
  if (project !== undefined && typeof project !== "string") {
    throw new DraftError(`event #${index}: project must be a string`);
  }

  return {
    ...(run === undefined ? {} : { run }),
    ...(project === undefined ? {} : { project }),
  };
}

function parseDraftEvent(raw: unknown, index: number): DraftEvent {
  if (isObject(raw)) {
    switch (raw.type) {
      case "draft_prompt":
        return parseDraftPrompt(raw, index);
      case "draft_message":
        return parseDraftMessage(raw, index);
      case "draft_intervention":
        return parseDraftIntervention(raw, index);
      case "draft_run":
        return parseDraftRun(raw, index);
      case "draft_check":
        return parseDraftCheck(raw, index);
    }
  }

  return { ...parseSessionEvent(raw, index), ...parseEventMarks(raw, index) };
}

function parseBuild(raw: unknown, index: number): DraftBuild {
  if (!isObject(raw)) throw new DraftError(`build #${index}: must be an object`);

  // Черновики до поля language лежат в capture/ и переносят редактуру в пересобранный черновик:
  // у них язык ещё ждёт редактуры.
  const { id, project, harness, workflow, title, language = "", runs } = raw;

  if (!isRecordId(id)) {
    throw new DraftError(
      `build #${index}: id must contain only letters, digits, underscores and hyphens`,
    );
  }
  if (
    typeof project !== "string" ||
    typeof harness !== "string" ||
    typeof workflow !== "string" ||
    typeof title !== "string" ||
    typeof language !== "string"
  ) {
    throw new DraftError(
      `build ${id}: project, harness, workflow, title and language must be strings`,
    );
  }
  if (!isStrings(runs)) throw new DraftError(`build ${id}: runs must be a list of strings`);

  return { id, project, harness, workflow, title, language, runs: [...runs] };
}

function parseBuilds(raw: Record<string, unknown>): DraftBuild[] {
  if (!Array.isArray(raw.builds) || raw.builds.length === 0) {
    throw new DraftError("draft must have at least one build in builds");
  }

  return raw.builds.map(parseBuild);
}

function checkBuildIds(builds: readonly DraftBuild[]): void {
  const seen = new Set<string>();

  for (const { id } of builds) {
    if (seen.has(id)) throw new DraftError(`build ${id} is listed in builds twice`);

    seen.add(id);
  }
}

function checkRunsAreUnique(builds: readonly DraftBuild[]): void {
  const owners = new Map<string, string>();
  const claims = builds.flatMap((build) => build.runs.map((run) => ({ run, buildId: build.id })));

  for (const { run, buildId } of claims) {
    const owner = owners.get(run);

    if (owner !== undefined && owner !== buildId) {
      throw new DraftError(`run ${run} is listed in two builds: ${owner} and ${buildId}`);
    }

    owners.set(run, buildId);
  }
}

function isEditable(event: DraftEvent): event is EditableDraftEvent {
  return (
    event.type === "draft_prompt" ||
    event.type === "draft_message" ||
    event.type === "draft_intervention"
  );
}

function checkEventBuilds(builds: readonly DraftBuild[], events: readonly DraftEvent[]): void {
  const known = new Set(builds.map(({ id }) => id));

  events.forEach((event, index) => {
    if (!isEditable(event)) return;
    if (event.build !== undefined && !known.has(event.build)) {
      throw new DraftError(`event #${index}: unknown build ${event.build}`);
    }
  });
}

/**
 * Проверяет черновик, прочитанный из файла: его правил редактор, поэтому доверять ему нельзя.
 * Чистовые версии промптов могут быть ещё пустыми — их проверяет публикация. Старый черновик
 * без `builds` читается как одна сборка с `id` черновика.
 * @param {unknown} raw Разобранный JSON черновика.
 * @returns {Draft} Проверенный черновик.
 * @throws {DraftError} Если поля черновика, его сборок, промптов или реплик не того типа,
 *   сборок нет, `id` сборки повторяется, запуск указан в двух сборках или событие ссылается
 *   на неизвестную сборку.
 * @throws {RecordError} Если событие цеха в черновике не соответствует формату ядра.
 */
export function parseDraft(raw: unknown): Draft {
  if (!isObject(raw)) throw new DraftError("draft must be an object");

  const { id, startedAt, events } = raw;

  if (typeof id !== "string" || typeof startedAt !== "string") {
    throw new DraftError("draft must have id and startedAt");
  }

  const builds = parseBuilds(raw);

  checkBuildIds(builds);
  checkRunsAreUnique(builds);

  if (!Array.isArray(events)) throw new DraftError("draft has no events");

  const parsedEvents = events.map(parseDraftEvent);

  checkEventBuilds(builds, parsedEvents);

  return { id, startedAt, builds, events: parsedEvents };
}

// Правка пересобранного черновика узнаётся по времени и исходному тексту: у той же сессии
// они не меняются, а новое событие ни с чем не совпадёт.
function sameSaid(a: EditableDraftEvent, b: EditableDraftEvent): boolean {
  return a.type === b.type && a.t === b.t && a.said === b.said;
}

function editableEventsOf(draft: Draft): EditableDraftEvent[] {
  return draft.events.filter(isEditable);
}

// Отредактированным считается промпт, в котором заполнено хоть что-то из чистовой версии,
// который склеен с предыдущим или которому редактор назначил сборку, а реплика и вмешательство —
// с заполненной строкой или текстом или с назначенной сборкой.
function isEdited(event: EditableDraftEvent): boolean {
  switch (event.type) {
    case "draft_prompt":
      return (
        event.goal !== "" ||
        event.requirements.length > 0 ||
        event.joined === true ||
        event.build !== undefined
      );
    case "draft_message":
    case "draft_intervention":
      return event.line !== "" || event.text !== "" || event.build !== undefined;
    default:
      return event satisfies never;
  }
}

function editedEventsOf(draft: Draft): EditableDraftEvent[] {
  return editableEventsOf(draft).filter(isEdited);
}

// Заполненное редактором значение прошлого черновика важнее значения из журнала.
function filledOr(earlier: string, fresh: string): string {
  return earlier === "" ? fresh : earlier;
}

function buildMark(earlier: { build?: string }): { build?: string } {
  return earlier.build === undefined ? {} : { build: earlier.build };
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
    ...buildMark(earlier),
  };
}

function carryOverMessage(earlier: DraftMessage, fresh: DraftMessage): DraftMessage {
  return { ...fresh, line: earlier.line, text: earlier.text, ...buildMark(earlier) };
}

function carryOverIntervention(
  earlier: DraftIntervention,
  fresh: DraftIntervention,
): DraftIntervention {
  return { ...fresh, line: earlier.line, text: earlier.text, ...buildMark(earlier) };
}

function carryOverEvent(event: DraftEvent, edited: readonly EditableDraftEvent[]): DraftEvent {
  if (!isEditable(event)) return event;

  const earlier = edited.find((candidate) => sameSaid(candidate, event));

  if (earlier === undefined) return event;
  // sameSaid проверил, что типы совпадают, а сузить пару через него компилятор не может.
  if (event.type === "draft_prompt" && earlier.type === "draft_prompt") {
    return carryOverPrompt(earlier, event);
  }
  if (event.type === "draft_message" && earlier.type === "draft_message") {
    return carryOverMessage(earlier, event);
  }
  if (event.type === "draft_intervention" && earlier.type === "draft_intervention") {
    return carryOverIntervention(earlier, event);
  }

  return event;
}

// Журнал знает проект и версию harness только первой сборки (по ней шла сессия), остальные
// сборки редактор завёл сам и их шапку заполняет тоже он.
function carryOverBuilds(previous: Draft, next: Draft): DraftBuild[] {
  const fresh = next.builds[0];

  return previous.builds.map((build) =>
    fresh?.id === build.id
      ? {
          ...build,
          project: filledOr(build.project, fresh.project),
          harness: filledOr(build.harness, fresh.harness),
          workflow: filledOr(build.workflow, fresh.workflow),
        }
      : build,
  );
}

/**
 * Переносит редактуру из прошлого черновика той же сессии в пересобранный: сборки с их
 * заголовками, проектами, версиями завода и запусками, чистовые промпты, пометки «склеен»,
 * реплики, вмешательства и сборки у промптов, реплик и вмешательств. Пустые проект и версия
 * harness у сборки с `id` первой сборки пересобранного черновика берутся из журнала. Новые
 * промпты и реплики остаются пустыми.
 * @param {Draft} previous Прошлый черновик с уже сделанной редактурой.
 * @param {Draft} next Черновик, только что собранный из журнала.
 * @returns {Draft} Пересобранный черновик с перенесённой редактурой.
 */
export function carryOverEdits(previous: Draft, next: Draft): Draft {
  const edited = editedEventsOf(previous);
  const events = next.events.map((event) => carryOverEvent(event, edited));

  return { ...next, builds: carryOverBuilds(previous, next), events };
}

/**
 * Находит поля шапки сборок черновика, которые ещё ждут редактуры: заголовок, язык, проект,
 * версию harness и процесс.
 * @param {Draft} draft Черновик записей.
 * @returns {UnfilledBuild[]} По элементу на каждую сборку с пустыми полями, поля — по порядку
 *   шапки; заполненные сборки пропущены.
 */
export function unfilledHeader(draft: Draft): UnfilledBuild[] {
  return draft.builds.flatMap((build) => {
    const fields = HEADER_FIELDS.filter((field) => build[field] === "");

    return fields.length === 0 ? [] : [{ buildId: build.id, fields }];
  });
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

/**
 * Находит запуски, которые редактор указал в сборках, а в журнале их нет: например, запуск
 * записан с опечаткой в `agentId`.
 * @param {Draft} draft Черновик записей.
 * @returns {string[]} Запуски из `runs` сборок, для которых в событиях нет окна `draft_run`.
 */
export function orphanedRuns(draft: Draft): string[] {
  const runs = draft.events.flatMap((event) => (event.type === "draft_run" ? [event.run] : []));
  const known = new Set(runs);

  return draft.builds.flatMap((build) => build.runs).filter((run) => !known.has(run));
}

/**
 * Находит реплики, чей маршрут поменялся при пересчёте, хотя редактор уже написал для них
 * строку: её писали для прошлого маршрута и её надо перечитать.
 * @param {Draft} previous Прошлый черновик с редактурой.
 * @param {Draft} next Пересобранный черновик с пересчитанными маршрутами.
 * @returns {DraftMessage[]} Реплики пересобранного черновика с заполненной строкой, у которых
 *   `from` или `to` отличаются от прошлых.
 */
export function reroutedMessages(previous: Draft, next: Draft): DraftMessage[] {
  const earlier = previous.events.filter((event) => event.type === "draft_message");

  return next.events.flatMap((event) => {
    if (event.type !== "draft_message" || event.line === "") return [];

    const was = earlier.find((candidate) => sameSaid(candidate, event));

    return was !== undefined && (was.from !== event.from || was.to !== event.to) ? [event] : [];
  });
}

function toPublishedPrompt(
  prompt: Pick<DraftPrompt, "goal" | "requirements" | "model">,
  t: number,
): SessionEvent {
  const { goal, requirements, model } = prompt;

  return { t, type: "prompt", goal, requirements, ...(model === undefined ? {} : { model }) };
}

function toPublishedIntervention(
  intervention: Pick<InterventionEvent, "reason" | "line" | "text">,
  t: number,
): SessionEvent {
  const { reason, line, text } = intervention;

  return { t, type: "intervention", reason, line, text };
}

function toPublishedMessage(
  message: Pick<DraftMessage, "from" | "to" | "line" | "text">,
  t: number,
): SessionEvent {
  const { from, to, line, text } = message;

  return { t, type: "message", from, to, line, text };
}

// Склеенный промпт вошёл в предыдущий несклеенный, поэтому без него ему некуда войти.
// Повтор этапа, на котором сборка уже стоит, в запись не идёт: его дали два запуска подряд.
// Время события переводит `at`: от первого события сборки и без долгих пауз.
function toPublishedEvents(
  events: readonly DraftEvent[],
  at: (t: number) => number,
): SessionEvent[] {
  const published: SessionEvent[] = [];
  let hasPrompt = false;
  let currentStage: Stage | undefined;

  events.forEach((event, index) => {
    switch (event.type) {
      case "draft_prompt":
        if (event.joined !== true) {
          hasPrompt = true;
          published.push(toPublishedPrompt(event, at(event.t)));
        } else if (!hasPrompt) {
          throw new DraftError(`event #${index}: joined prompt has no previous prompt`);
        }

        return;
      case "prompt":
        hasPrompt = true;
        published.push(toPublishedPrompt(event, at(event.t)));

        return;
      case "draft_message":
      case "message":
        published.push(toPublishedMessage(event, at(event.t)));

        return;
      case "draft_intervention":
      case "intervention":
        published.push(toPublishedIntervention(event, at(event.t)));

        return;
      case "stage_enter":
        if (event.stage === currentStage) return;

        currentStage = event.stage;
        published.push({ t: at(event.t), type: "stage_enter", stage: event.stage });

        return;
      case "stage_fail":
        published.push({
          t: at(event.t),
          type: "stage_fail",
          stage: event.stage,
          reason: event.reason,
        });

        return;
      case "draft_run":
      case "draft_check":
      case "build_start":
      case "build_end":
      case "usage":
        return;
      default:
        return event satisfies never;
    }
  });

  return published;
}

function textsOf(event: SessionEvent): string[] {
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
    case "intervention":
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

// Исход сборки — последний вердикт или запуск проверок; без проверок сборка считается удачной.
function checksPassed(events: readonly DraftEvent[]): boolean {
  return events.findLast((event) => event.type === "draft_check")?.ok ?? true;
}

function totalTokens(events: readonly DraftEvent[]): number | undefined {
  const usages = events.filter((event) => event.type === "usage");

  return usages.length === 0 ? undefined : usages.reduce((sum, { tokens }) => sum + tokens, 0);
}

function buildOf(draft: Draft, buildId: string): DraftBuild {
  const build = draft.builds.find(({ id }) => id === buildId);

  if (build === undefined) throw new DraftError(`draft has no build ${buildId}`);

  return build;
}

function checkNoLeaks({ data }: SessionRecord, buildId: string): void {
  const texts = [data.title, data.harness, data.workflow, ...data.events.flatMap(textsOf)];
  const leaks = texts.flatMap((text) => findLeaks(text).map((kind) => ({ kind, text })));

  if (leaks.length === 0) return;

  throw new ClaudeError((messages) => {
    const described = leaks.map(({ kind, text }) =>
      messages.errors.leakIn({ kind: messages.leakKinds[kind], text }),
    );

    return messages.errors.leaksFound({ buildId, leaks: described.join("; ") });
  });
}

/**
 * Превращает одну сборку отредактированного черновика в запись для сайта: только события
 * этой сборки, время от её первого события и без долгих пауз, без исходных текстов промптов
 * и реплик, без исходных текстов вмешательств, без пометок `project`, без склеенных промптов
 * и служебных событий черновика.
 * @param {Draft} draft Черновик с заполненными заголовком, проектом, версией harness,
 *   чистовыми промптами и репликами публикуемой сборки.
 * @param {string} buildId Идентификатор публикуемой сборки.
 * @returns {SessionRecord} Запись с `id` сборки, прошедшая проверку формата ядра.
 * @throws {RecordError} Если заголовок, проект, версия harness, чистовой промпт или реплика
 *   сборки пусты или запись не соответствует формату ядра.
 * @throws {DraftError} Если сборки нет или склеенный промпт стоит без предыдущего несклеенного.
 * @throws {ClaudeError} Если в сборке нет событий или в тексте для публикации похоже на адрес,
 *   ключ или личный путь.
 */
export function publishBuild(draft: Draft, buildId: string): SessionRecord {
  const build = buildOf(draft, buildId);
  const owners = eventBuilds(draft);
  const events = draft.events.filter((_event, index) => owners[index] === buildId);
  const timeline = buildTimeline(events);

  if (timeline === undefined) {
    throw new ClaudeError((messages) => messages.errors.buildHasNoEvents(buildId));
  }

  const tokens = totalTokens(events);
  const usage: SessionEvent[] =
    tokens === undefined ? [] : [{ t: timeline.end, type: "usage", tokens }];
  const published: SessionEvent[] = [
    { t: 0, type: "build_start" },
    ...toPublishedEvents(events, timeline.at),
    ...usage,
    { t: timeline.end, type: "build_end", ok: checksPassed(events) },
  ];
  const record = parseRecord({
    version: RECORD_VERSION,
    type: "session",
    id: build.id,
    timestamp: new Date(Date.parse(draft.startedAt) + timeline.start).toISOString(),
    projectId: build.project,
    source: CLAUDE_SOURCE,
    data: {
      title: build.title,
      language: build.language,
      workflow: build.workflow,
      harness: build.harness,
      events: published,
    },
  });

  if (record.type !== "session") {
    throw new DraftError(`build ${buildId} was not published as a session`);
  }

  checkNoLeaks(record, buildId);

  return record;
}

/**
 * Превращает все сборки черновика в записи для сайта; если не готова хоть одна, бросает ошибку.
 * @param {Draft} draft Черновик со всеми заполненными сборками.
 * @returns {SessionRecord[]} Записи по порядку сборок черновика.
 * @throws {RecordError} Если сборка не соответствует формату ядра.
 * @throws {DraftError} По тем же причинам, что и `publishBuild`.
 * @throws {ClaudeError} По тем же причинам, что и `publishBuild`.
 */
export function publishDraft(draft: Draft): SessionRecord[] {
  return draft.builds.map((build) => publishBuild(draft, build.id));
}
