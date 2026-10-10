import {
  averagePerBuild,
  humanInputOf,
  type RecordingTotals,
  type StageReworks,
} from "@/entities/recording";
import { STAGE_LABELS } from "@/shared/config/stages.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import {
  formatCount,
  formatDuration,
  formatNumber,
  formatPercent,
  formatTokens,
} from "@/shared/lib/format.ts";
import type { StatItem } from "@/shared/ui";

const TEXT = UI_TEXT.projectPanel;
const REWORKS_TEXT = UI_TEXT.reworks;
const DETAIL_SEPARATOR = " · ";

function firstPassItemOf(totals: RecordingTotals, locale: Locale): StatItem {
  const share = totals.builds === 0 ? 0 : totals.buildsWithoutReworks / totals.builds;

  return {
    label: REWORKS_TEXT.firstPass[locale],
    value: formatPercent(share, locale),
    detail: REWORKS_TEXT.firstPassOf[locale](totals.buildsWithoutReworks, totals.builds),
  };
}

function reworksItemOf(
  totals: RecordingTotals,
  stageReworks: readonly StageReworks[],
  locale: Locale,
): StatItem {
  const label = TEXT.reworks[locale];
  const value = formatNumber(totals.reworks, locale);

  if (stageReworks.length === 0) return { label, value };

  const byStage = stageReworks.map(
    ({ stage, count }) => `${STAGE_LABELS[stage][locale]} ${formatNumber(count, locale)}`,
  );

  return { label, value, detail: byStage.join(DETAIL_SEPARATOR) };
}

function humanInputItemOf(totals: RecordingTotals, locale: Locale): StatItem {
  const humanInput = humanInputOf(totals);
  const prompts = formatCount(totals.prompts, UI_TEXT.lists.prompts, locale);
  const interventions = formatCount(totals.interventions, TEXT.interventions, locale);

  return {
    label: TEXT.human[locale],
    value: formatNumber(humanInput, locale),
    detail: `${prompts}${DETAIL_SEPARATOR}${interventions}`,
  };
}

/**
 * Prepares project totals for display as counters: builds, time in total and on average per build,
 * tokens, the share of builds that passed on the first try, reworks by stage, and human
 * involvement.
 * @param {RecordingTotals} totals Totals of the project builds.
 * @param {readonly StageReworks[]} stageReworks Reworks of the project builds by stage, in process
 * order, without stages that never sent the work back.
 * @param {Locale} locale Page language: captions, numbers and duration are in it.
 * @returns {StatItem[]} Counters in order.
 */
export function projectTotalsOf(
  totals: RecordingTotals,
  stageReworks: readonly StageReworks[],
  locale: Locale,
): StatItem[] {
  const durationPerBuild = averagePerBuild(totals, "durationMs");

  return [
    { label: TEXT.builds[locale], value: formatNumber(totals.builds, locale) },
    { label: TEXT.duration[locale], value: formatDuration(totals.durationMs, locale) },
    { label: TEXT.durationPerBuild[locale], value: formatDuration(durationPerBuild, locale) },
    { label: TEXT.tokens[locale], value: formatTokens(totals.tokens, locale) },
    firstPassItemOf(totals, locale),
    reworksItemOf(totals, stageReworks, locale),
    humanInputItemOf(totals, locale),
  ];
}
