import type { SessionRecord } from "@cyberzavod/core";

/**
 * Recording order in a list: latest started first.
 * @param {SessionRecord} a First recording.
 * @param {SessionRecord} b Second recording.
 * @returns {number} A negative number if `a` comes before `b`.
 */
export function newestFirst(a: SessionRecord, b: SessionRecord): number {
  // ISO 8601 UTC times compare as strings; on equal times the id decides the order.
  return b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id);
}

/**
 * Task order within a project: earliest started first, the order they were done in.
 * @param {SessionRecord} a First recording.
 * @param {SessionRecord} b Second recording.
 * @returns {number} A negative number if `a` comes before `b`.
 */
export function oldestFirst(a: SessionRecord, b: SessionRecord): number {
  return newestFirst(b, a);
}
