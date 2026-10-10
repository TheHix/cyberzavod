// Type guard shared by the parsers of JSON files.

/**
 * Whether the value is a plain object (not null, not an array).
 * @param {unknown} value Parsed JSON value.
 * @returns {boolean} true for an object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
