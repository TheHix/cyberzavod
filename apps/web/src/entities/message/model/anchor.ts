/**
 * Message anchor in the journal: "more" above the factory floor finds the entry by it.
 * @param {number} index Message number in the recording, from zero.
 * @returns {string} Journal element id, e.g. `message-1` for the first message.
 */
export function messageAnchor(index: number): string {
  return `message-${index + 1}`;
}
