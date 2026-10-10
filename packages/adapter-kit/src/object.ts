// Type guard and field reader shared by the parsers of JSON files and hook payloads.

/**
 * Whether the value is a plain object (not null, not an array).
 * @param {unknown} value Parsed JSON value.
 * @returns {boolean} true for an object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A string field of an object, for reading hook payloads that may hold anything.
 * @param {Record<string, unknown>} object Parsed JSON object.
 * @param {string} key Field name.
 * @returns {string | undefined} The value if it is a string, otherwise undefined.
 */
export function stringField(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];

  return typeof value === "string" ? value : undefined;
}
