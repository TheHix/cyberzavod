// Сборки сессии: какие события черновика к какой записи относятся и как считается время сборки.
// Сборка — набор событий, а не отрезок времени: задачи в одной сессии идут вперемешку.

import type { Draft, DraftEvent, DraftRun } from "./draft.ts";

/**
 * Самая долгая пауза в записи сборки: промежуток, в котором у сборки не работает ни одна
 * станция и нет её событий, сжимается до неё. Так в длительность не входит ни ожидание
 * человека, ни время, когда дирижёр занят другой задачей.
 */
export const IDLE_GAP_MS = 2 * 60 * 1000;

function runOf(event: DraftEvent): string | undefined {
  return event.type === "draft_prompt" ? undefined : event.run;
}

// Сборка, которую событие называет само: промпт и реплика — полем `build` (у реплики оно
// перекрывает запуск), события станций — запуском. Остальные события сборки не называют.
function namedBuild(
  event: DraftEvent,
  buildOfRun: ReadonlyMap<string, string>,
  firstBuild: string,
): string | undefined {
  if (
    (event.type === "draft_prompt" || event.type === "draft_message") &&
    event.build !== undefined
  ) {
    return event.build;
  }
  const run = runOf(event);
  return run === undefined ? undefined : (buildOfRun.get(run) ?? firstBuild);
}

/**
 * Определяет сборку каждого события черновика. Запуск станции относится к сборке, в чьём
 * списке `runs` он указан, промпт человека — к сборке в его поле `build`; остальные события
 * основной сессии — к сборке ближайшего предыдущего события, у которого она определена,
 * а до первого такого события — к первой сборке. Запуск, не указанный ни в одной сборке,
 * относится к первой.
 * @param {Draft} draft Черновик, в котором есть хотя бы одна сборка.
 * @returns {string[]} `id` сборки для каждого события черновика, в том же порядке.
 * @throws {Error} Если в черновике нет сборок: `parseDraft` такой черновик не пропускает.
 */
export function eventBuilds(draft: Draft): string[] {
  const firstBuild = draft.builds[0]?.id;
  if (firstBuild === undefined) throw new Error("в черновике нет сборок");
  const buildOfRun = new Map(draft.builds.flatMap(({ id, runs }) => runs.map((run) => [run, id])));
  let current = firstBuild;
  return draft.events.map((event) => {
    current = namedBuild(event, buildOfRun, firstBuild) ?? current;
    return current;
  });
}

/**
 * Находит запуски станций, которые не указаны ни в одной сборке: они достанутся первой.
 * @param {Draft} draft Черновик записей.
 * @returns {DraftRun[]} Окна таких запусков по порядку журнала.
 */
export function unassignedRuns(draft: Draft): DraftRun[] {
  const assigned = new Set(draft.builds.flatMap(({ runs }) => runs));
  return draft.events.flatMap((event) =>
    event.type === "draft_run" && !assigned.has(event.run) ? [event] : [],
  );
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
 * @param {DraftEvent[]} events События одной сборки по порядку.
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
