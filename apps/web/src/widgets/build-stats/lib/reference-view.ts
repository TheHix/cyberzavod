import { averagePerBuild, humanInputOf, type RecordingTotals } from "@/entities/recording";
import type { Locale, Translated } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatDuration } from "@/shared/lib/format.ts";
import type { BarItem } from "@/shared/ui";
import { barOf } from "./bars.ts";

/** Эталонный проект в сравнении: название на языке страницы и итоги его сборок. */
export interface ReferenceProject {
  readonly name: string;
  readonly totals: RecordingTotals;
}

/** Диаграмма сравнения: заголовок метрики и по строке на проект. */
export interface ReferenceChart {
  readonly heading: string;
  readonly bars: readonly BarItem[];
}

type ProjectBar = (project: ReferenceProject, locale: Locale) => BarItem;

interface ReferenceMetric {
  readonly heading: Translated;
  readonly barOfProject: ProjectBar;
}

// Возвратов на сборку — около одного: в целых числах проекты не различить.
const HUNDREDTHS = 100;

function roundedToHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

function durationPerBuildBar(project: ReferenceProject, locale: Locale): BarItem {
  const durationMs = averagePerBuild(project.totals, "durationMs");

  return { label: project.name, value: durationMs, valueText: formatDuration(durationMs, locale) };
}

function tokensPerBuildBar(project: ReferenceProject, locale: Locale): BarItem {
  const tokens = Math.round(averagePerBuild(project.totals, "tokens"));

  return barOf(project.name, tokens, locale);
}

function reworksPerBuildBar(project: ReferenceProject, locale: Locale): BarItem {
  const reworks = roundedToHundredths(averagePerBuild(project.totals, "reworks"));

  return barOf(project.name, reworks, locale);
}

function humanInputBar(project: ReferenceProject, locale: Locale): BarItem {
  return barOf(project.name, humanInputOf(project.totals), locale);
}

// Новая метрика сравнения — новая строка таблицы.
const REFERENCE_METRICS: readonly ReferenceMetric[] = [
  { heading: UI_TEXT.statsSections.durationPerBuild, barOfProject: durationPerBuildBar },
  { heading: UI_TEXT.statsSections.tokensPerBuild, barOfProject: tokensPerBuildBar },
  { heading: UI_TEXT.statsSections.reworksPerBuild, barOfProject: reworksPerBuildBar },
  { heading: UI_TEXT.statsSections.human, barOfProject: humanInputBar },
];

/**
 * Готовит сравнение эталонных проектов: время и токены в среднем на сборку, возвраты на сборку
 * и участие человека — по диаграмме на метрику, строки в порядке проектов.
 * @param {readonly ReferenceProject[]} projects Проекты в порядке, в каком завод за них брался.
 * @param {Locale} locale Язык страницы: на нём заголовки, числа и длительность.
 * @returns {ReferenceChart[]} Диаграммы по метрикам.
 */
export function referenceChartsOf(
  projects: readonly ReferenceProject[],
  locale: Locale,
): ReferenceChart[] {
  return REFERENCE_METRICS.map((metric) => ({
    heading: metric.heading[locale],
    bars: projects.map((project) => metric.barOfProject(project, locale)),
  }));
}
