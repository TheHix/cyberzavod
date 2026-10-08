import { summarize, type BuildStats, type SessionRecord } from "@cyberzavod/core";

/** Итоги нескольких сборок, например всех сборок проекта: суммы их счётчиков. */
export interface RecordingTotals {
  /** Сколько сборок в итогах. */
  readonly builds: number;
  readonly durationMs: number;
  readonly tokens: number;
  readonly prompts: number;
  /** Возвраты на доработку во всех сборках. */
  readonly reworks: number;
  /** Сколько сборок прошли все этапы с первого раза. */
  readonly buildsWithoutReworks: number;
  readonly interventions: number;
}

/** Счётчик итогов, который можно разделить на сборки, чтобы получить среднее. */
export type SummedCount = Exclude<keyof RecordingTotals, "builds">;

const NO_TOTALS: RecordingTotals = {
  builds: 0,
  durationMs: 0,
  tokens: 0,
  prompts: 0,
  reworks: 0,
  buildsWithoutReworks: 0,
  interventions: 0,
};

function withBuild(totals: RecordingTotals, build: BuildStats): RecordingTotals {
  const isWithoutReworks = build.reworks === 0;

  return {
    builds: totals.builds + 1,
    durationMs: totals.durationMs + build.durationMs,
    tokens: totals.tokens + build.tokens,
    prompts: totals.prompts + build.prompts,
    reworks: totals.reworks + build.reworks,
    buildsWithoutReworks: totals.buildsWithoutReworks + (isWithoutReworks ? 1 : 0),
    interventions: totals.interventions + build.interventions,
  };
}

/**
 * Складывает счётчики сборок: так считаются итоги проекта при сборке сайта, без API.
 * @param {readonly SessionRecord[]} recordings Записи сборок в любом порядке.
 * @returns {RecordingTotals} Итоги; у пустого списка все счётчики нулевые.
 */
export function totalsOf(recordings: readonly SessionRecord[]): RecordingTotals {
  const builds = recordings.map((recording) => summarize(recording));

  return builds.reduce(withBuild, NO_TOTALS);
}

/**
 * Среднее значение счётчика на одну сборку. Округляет тот, кто показывает: время — до секунд.
 * @param {RecordingTotals} totals Итоги сборок.
 * @param {SummedCount} count Какой счётчик делить.
 * @returns {number} Частное без округления; у итогов без сборок — 0.
 */
export function averagePerBuild(totals: RecordingTotals, count: SummedCount): number {
  if (totals.builds === 0) return 0;

  return totals[count] / totals.builds;
}

/**
 * Участие человека в сборках: его промпты и вмешательства вместе.
 * @param {RecordingTotals} totals Итоги сборок.
 * @returns {number} Сколько раз человек что-то сказал цеху.
 */
export function humanInputOf(totals: RecordingTotals): number {
  return totals.prompts + totals.interventions;
}
