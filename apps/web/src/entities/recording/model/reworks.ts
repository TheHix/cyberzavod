import { reworksOf, STAGES, type SessionRecord, type Stage } from "@cyberzavod/core";

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
