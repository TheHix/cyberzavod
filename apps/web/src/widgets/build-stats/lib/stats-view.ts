import { INTERVENTION_REASONS, isStage, type InterventionReason } from "@cyberzavod/core";
import type { BuildStats, TallyRow } from "@/entities/stats";
import { INTERVENTION_LABELS } from "@/shared/config/interventions.ts";
import { STAGE_LABELS } from "@/shared/config/stages.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatNumber, formatTokens } from "@/shared/lib/format.ts";
import type { BarItem, StatItem } from "@/shared/ui";
import { barOf } from "./bars.ts";

/**
 * What the analytics page shows: a placeholder while there are no builds, or numbers and charts.
 */
export type StatsView =
  | { readonly kind: "empty" }
  | {
      readonly kind: "filled";
      readonly totals: readonly StatItem[];
      readonly returns: readonly BarItem[];
      readonly interventions: readonly BarItem[];
      readonly outcomes: readonly BarItem[];
    };

function isInterventionReason(key: string): key is InterventionReason {
  return (INTERVENTION_REASONS as readonly string[]).includes(key);
}

// Values from recordings are not filtered: a stage or reason unknown to the site is labeled as is.
function stageLabel(key: string, locale: Locale): string {
  return isStage(key) ? STAGE_LABELS[key][locale] : key;
}

function reasonLabel(key: string, locale: Locale): string {
  return isInterventionReason(key) ? INTERVENTION_LABELS[key][locale] : key;
}

// The most frequent on top: the chart answers where the process stalls the most.
function mostFirst(a: BarItem, b: BarItem): number {
  return b.value - a.value || a.label.localeCompare(b.label);
}

function barsOf(
  rows: readonly TallyRow[],
  labelOf: (key: string, locale: Locale) => string,
  locale: Locale,
): BarItem[] {
  return rows.map((row) => barOf(labelOf(row.key, locale), row.count, locale)).sort(mostFirst);
}

function totalOf(rows: readonly TallyRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function totalsOf(stats: BuildStats, locale: Locale): StatItem[] {
  return [
    { label: UI_TEXT.stats.builds[locale], value: formatNumber(stats.recordings, locale) },
    { label: UI_TEXT.stats.authors[locale], value: formatNumber(stats.authors, locale) },
    { label: UI_TEXT.hud.tokens[locale], value: formatTokens(stats.tokens, locale) },
    { label: UI_TEXT.hud.reworks[locale], value: formatNumber(totalOf(stats.returns), locale) },
    {
      label: UI_TEXT.hud.interventions[locale],
      value: formatNumber(totalOf(stats.interventions), locale),
    },
  ];
}

/**
 * Prepares analytics for display: numbers and charts of rework by stage, interventions by reason
 * and build outcomes, labeled in the page language.
 * @param {BuildStats} stats API response.
 * @param {Locale} locale Page language.
 * @returns {StatsView} A placeholder if there are no builds, otherwise numbers and chart rows.
 */
export function statsViewOf(stats: BuildStats, locale: Locale): StatsView {
  if (stats.recordings === 0) return { kind: "empty" };

  return {
    kind: "filled",
    totals: totalsOf(stats, locale),
    returns: barsOf(stats.returns, stageLabel, locale),
    interventions: barsOf(stats.interventions, reasonLabel, locale),
    outcomes: [
      barOf(UI_TEXT.stats.succeeded[locale], stats.outcomes.ok, locale),
      barOf(UI_TEXT.stats.failed[locale], stats.outcomes.failed, locale),
    ],
  };
}
