import type { SessionRecord } from "@cyberzavod/core";
import { oldestFirst } from "./order.ts";

/** How many recordings with one task label make a comparison: one run has nothing to compare to. */
export const MIN_COMPARED_RECORDINGS = 2;

/** Runs of one task: the recordings that carry the same task label. */
export interface TaskComparison {
  /** Task label, as in `data.task` of the recordings. */
  readonly task: string;
  /** The runs, earliest started first. */
  readonly recordings: readonly SessionRecord[];
}

function tasksInOrderOfAppearance(ordered: readonly SessionRecord[]): readonly string[] {
  const tasks = ordered.flatMap((recording) => recording.data.task ?? []);

  return [...new Set(tasks)];
}

/**
 * Groups recordings by task label: every label with at least two recordings is a comparison.
 * Recordings without a label take no part. The label is global for the site, not per project:
 * another agent's run of the task may live in another project.
 * @param {readonly SessionRecord[]} recordings Build recordings in any order.
 * @returns {TaskComparison[]} Comparisons in the order their first runs started.
 */
export function taskComparisonsOf(recordings: readonly SessionRecord[]): TaskComparison[] {
  const ordered = [...recordings].sort(oldestFirst);
  const tasks = tasksInOrderOfAppearance(ordered);
  const comparisons = tasks.map((task) => ({
    task,
    recordings: ordered.filter((recording) => recording.data.task === task),
  }));

  return comparisons.filter(
    (comparison) => comparison.recordings.length >= MIN_COMPARED_RECORDINGS,
  );
}

/**
 * Finds the comparison a recording belongs to.
 * @param {readonly SessionRecord[]} recordings All build recordings of the site.
 * @param {SessionRecord} recording The recording to look for.
 * @returns {TaskComparison | undefined} The comparison of the recording's task; `undefined` if it
 * has no label or is the only run of its task.
 */
export function comparisonOfRecording(
  recordings: readonly SessionRecord[],
  recording: SessionRecord,
): TaskComparison | undefined {
  const { task } = recording.data;

  if (task === undefined) return undefined;

  return taskComparisonsOf(recordings).find((comparison) => comparison.task === task);
}
