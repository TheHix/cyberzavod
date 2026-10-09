import { averagePerBuild, humanInputOf, type RecordingTotals } from "@/entities/recording";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatCount, formatDuration, formatNumber, formatTokens } from "@/shared/lib/format.ts";
import type { StatItem } from "@/shared/ui";

const TEXT = UI_TEXT.projectPanel;

function reworksItemOf(totals: RecordingTotals, locale: Locale): StatItem {
  return {
    label: TEXT.reworks[locale],
    value: formatNumber(totals.reworks, locale),
    detail: TEXT.withoutReworks[locale](totals.buildsWithoutReworks, totals.builds),
  };
}

function humanInputItemOf(totals: RecordingTotals, locale: Locale): StatItem {
  const humanInput = humanInputOf(totals);
  const prompts = formatCount(totals.prompts, UI_TEXT.lists.prompts, locale);
  const interventions = formatCount(totals.interventions, TEXT.interventions, locale);

  return {
    label: TEXT.human[locale],
    value: formatNumber(humanInput, locale),
    detail: `${prompts} · ${interventions}`,
  };
}

/**
 * Prepares project totals for display as counters: builds, time in total and on average per build,
 * tokens, rework with builds without it, and human involvement.
 * @param {RecordingTotals} totals Totals of the project builds.
 * @param {Locale} locale Page language: captions, numbers and duration are in it.
 * @returns {StatItem[]} Counters in order.
 */
export function projectTotalsOf(totals: RecordingTotals, locale: Locale): StatItem[] {
  const durationPerBuild = averagePerBuild(totals, "durationMs");

  return [
    { label: TEXT.builds[locale], value: formatNumber(totals.builds, locale) },
    { label: TEXT.duration[locale], value: formatDuration(totals.durationMs, locale) },
    { label: TEXT.durationPerBuild[locale], value: formatDuration(durationPerBuild, locale) },
    { label: TEXT.tokens[locale], value: formatTokens(totals.tokens, locale) },
    reworksItemOf(totals, locale),
    humanInputItemOf(totals, locale),
  ];
}
