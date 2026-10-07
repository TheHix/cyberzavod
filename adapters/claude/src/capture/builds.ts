// Сборки сессии: какие события черновика к какой записи относятся и как считается время сборки.
// Сборка — набор событий, а не отрезок времени: задачи в одной сессии идут вперемешку, а команды
// основной сессии относятся к сборке своего проекта по пометке `project`.

import type { Draft, DraftEvent, DraftRun } from "./draft.ts";

/**
 * Самая долгая пауза в записи сборки: промежуток, в котором у сборки не работает ни одна
 * станция и нет её событий, сжимается до неё. Так в длительность не входит ни ожидание
 * человека, ни время, когда дирижёр занят другой задачей.
 */
export const IDLE_GAP_MS = 2 * 60 * 1000;

function runOf(event: DraftEvent): string | undefined {
  return event.type === "draft_prompt" || event.type === "draft_intervention"
    ? undefined
    : event.run;
}

// Проект события основной сессии: его ставит `cyberzavod draft` по каталогу команды.
function projectOfEvent(event: DraftEvent): string | undefined {
  switch (event.type) {
    case "draft_prompt":
    case "draft_message":
    case "draft_intervention":
    case "draft_run":
      return undefined;
    default:
      return event.project;
  }
}

// Сборка, которую событие называет само: промпт, реплика и вмешательство — полем `build` (у реплики оно
// перекрывает запуск), события станций — запуском. Остальные события сборки не называют.
function namedBuild(
  event: DraftEvent,
  buildOfRun: ReadonlyMap<string, string>,
  firstBuild: string,
): string | undefined {
  if (
    (event.type === "draft_prompt" ||
      event.type === "draft_message" ||
      event.type === "draft_intervention") &&
    event.build !== undefined
  ) {
    return event.build;
  }
  const run = runOf(event);
  return run === undefined ? undefined : (buildOfRun.get(run) ?? firstBuild);
}

/**
 * Определяет сборку каждого события черновика по порядку правил:
 * 1. промпт, реплика и вмешательство — сборка из их поля `build`;
 * 2. событие станции — сборка, в чьём списке `runs` указан запуск, а не указанный нигде — первая;
 * 3. событие основной сессии с пометкой `project` — сборка этого проекта, к которой относилось
 *    ближайшее предыдущее событие, а если таких не было — первая по порядку сборка проекта;
 *    у проекта без сборок правило не действует;
 * 4. остальные события — сборка текущего события: последнего, у которого она определена правилами
 *    1 и 2, а до первого такого — первая сборка.
 * Событие, отнесённое по проекту, текущую сборку не меняет: ответ человеку остаётся в задаче
 * своего промпта. Угадывать задачу по `#N` не нужно: номера issue повторяются между проектами.
 * @param {Draft} draft Черновик, в котором есть хотя бы одна сборка.
 * @returns {string[]} `id` сборки для каждого события черновика, в том же порядке.
 * @throws {Error} Если в черновике нет сборок: `parseDraft` такой черновик не пропускает.
 */
export function eventBuilds(draft: Draft): string[] {
  const firstBuild = draft.builds[0]?.id;
  if (firstBuild === undefined) throw new Error("в черновике нет сборок");
  const buildOfRun = new Map(draft.builds.flatMap(({ id, runs }) => runs.map((run) => [run, id])));
  const projectOfBuild = new Map(draft.builds.map(({ id, project }) => [id, project]));
  const firstBuildOfProject = new Map<string, string>();
  for (const { id, project } of draft.builds) {
    if (project !== "" && !firstBuildOfProject.has(project)) firstBuildOfProject.set(project, id);
  }
  const lastBuildOfProject = new Map<string, string>();
  let current = firstBuild;
  return draft.events.map((event) => {
    const named = namedBuild(event, buildOfRun, firstBuild);
    if (named !== undefined) current = named;
    const project = projectOfEvent(event);
    const byProject =
      project === undefined
        ? undefined
        : (lastBuildOfProject.get(project) ?? firstBuildOfProject.get(project));
    const owner = named ?? byProject ?? current;
    const ownerProject = projectOfBuild.get(owner);
    if (ownerProject !== undefined && ownerProject !== "") {
      lastBuildOfProject.set(ownerProject, owner);
    }
    return owner;
  });
}

/**
 * Находит запуски станций, которые не указаны ни в одной сборке: они достанутся первой.
 * @param {Draft} draft Черновик записей.
 * @returns {DraftRun[]} Окно каждого такого запуска, первое, по порядку журнала: после
 *   `SendMessage` у одного запуска несколько окон.
 */
export function unassignedRuns(draft: Draft): DraftRun[] {
  const assigned = new Set(draft.builds.flatMap(({ runs }) => runs));
  const seen = new Set<string>();
  return draft.events.flatMap((event) => {
    if (event.type !== "draft_run" || assigned.has(event.run) || seen.has(event.run)) return [];
    seen.add(event.run);
    return [event];
  });
}

/**
 * Находит проекты, чьи события есть в черновике, а сборки нет: эти события достанутся сборке
 * по времени, и редактору стоит завести для проекта сборку.
 * @param {Draft} draft Черновик записей.
 * @returns {string[]} Проекты из пометок `project` без сборки, без повторов, по порядку появления.
 */
export function projectsWithoutBuild(draft: Draft): string[] {
  const withBuild = new Set(draft.builds.map(({ project }) => project));
  const missing = new Set<string>();
  for (const event of draft.events) {
    const project = projectOfEvent(event);
    if (project !== undefined && !withBuild.has(project)) missing.add(project);
  }
  return [...missing];
}

/** Время сборки без долгих пауз: от первого события и до конца её работы. */
export interface BuildTimeline {
  /** Время первого события сборки в черновике, миллисекунды от начала журнала. */
  start: number;
  /** Длительность сборки в записи, миллисекунды. */
  end: number;
  /** Переводит время события черновика во время записи. */
  at: (t: number) => number;
}

interface Span {
  from: number;
  to: number;
}

// Токены, начало и конец сборки времени не задают: их ставит публикация, а токены сессии
// в черновике стоят у ближайшего события, а не там, где что-то происходило.
function isTimed(event: DraftEvent): boolean {
  return event.type !== "usage" && event.type !== "build_start" && event.type !== "build_end";
}

// Занятое время сборки: окно запуска станции и момент каждого события.
function spanOf(event: DraftEvent): Span {
  return event.type === "draft_run"
    ? { from: event.t, to: Math.max(event.t, event.until) }
    : { from: event.t, to: event.t };
}

function mergedSpans(events: readonly DraftEvent[]): Span[] {
  const merged: Span[] = [];
  const spans = events.filter(isTimed).map(spanOf);
  for (const span of spans.sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last !== undefined && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * Считает время сборки: паузы длиннее `IDLE_GAP_MS`, когда у сборки не работает ни одна
 * станция и нет её событий, сжимаются до неё. Работа станции без событий внутри не пауза.
 * Конец сборки — её последнее событие или конец её последнего окна запуска.
 * @param {readonly DraftEvent[]} events События одной сборки по порядку.
 * @returns {BuildTimeline | undefined} Время сборки или undefined, если в ней нет событий
 *   со временем (токены, начало и конец не в счёт).
 */
export function buildTimeline(events: readonly DraftEvent[]): BuildTimeline | undefined {
  const spans = mergedSpans(events);
  const first = spans[0];
  const last = spans.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const cuts = spans.slice(1).flatMap((span, index) => {
    const gap = span.from - (spans[index]?.to ?? span.from);
    return gap > IDLE_GAP_MS ? [{ before: span.from, cut: gap - IDLE_GAP_MS }] : [];
  });
  const at = (t: number) =>
    t - first.from - cuts.filter(({ before }) => before <= t).reduce((sum, c) => sum + c.cut, 0);
  return { start: first.from, end: at(last.to), at };
}
