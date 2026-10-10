import { reworksOf, STAGES, type SessionRecord, type Stage } from "@cyberzavod/core";
import { STAGE_LABELS } from "@/shared/config/stages.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { formatNumber } from "@/shared/lib/format.ts";

const DETAIL_SEPARATOR = " · ";

/** How many times one stage sent the work back across several builds. */
export interface StageReworks {
  readonly stage: Stage;
  readonly count: number;
}

/**
 * Counts the reworks of several builds by the stage that sent the work back. Stages come in
 * process order, so the breakdown reads the same on every project; stages that never sent the work
 * back are left out.
 * @param {readonly SessionRecord[]} recordings Build recordings in any order.
 * @returns {StageReworks[]} Stages with their rework counts, only those with at least one.
 */
export function reworksByStageOf(recordings: readonly SessionRecord[]): StageReworks[] {
  const stages = recordings.flatMap((recording) =>
    reworksOf(recording).map((rework) => rework.stage),
  );

  return STAGES.map((stage) => ({
    stage,
    count: stages.filter((reworked) => reworked === stage).length,
  })).filter(({ count }) => count > 0);
}

/**
 * Writes the rework breakdown by stage as a note under a counter.
 * @param {readonly StageReworks[]} stageReworks Rework counts by stage, as `reworksByStageOf` gives.
 * @param {Locale} locale Page language: stage names and numbers are in it.
 * @returns {string | undefined} A string like "Review 17 · Verify 1"; in Russian «Ревью 17 ·
 * Проверки 1»; `undefined` if no stage sent the work back.
 */
export function stageReworksDetailOf(
  stageReworks: readonly StageReworks[],
  locale: Locale,
): string | undefined {
  if (stageReworks.length === 0) return undefined;

  const byStage = stageReworks.map(
    ({ stage, count }) => `${STAGE_LABELS[stage][locale]} ${formatNumber(count, locale)}`,
  );

  return byStage.join(DETAIL_SEPARATOR);
}
