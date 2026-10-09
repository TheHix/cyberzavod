/**
 * Intervention anchor in the journal: "more" above the factory floor finds the entry by it.
 * @param {number} index Intervention number in the recording, from zero.
 * @returns {string} Journal element id, e.g. `intervention-1` for the first intervention.
 */
export function interventionAnchor(index: number): string {
  return `intervention-${index + 1}`;
}
