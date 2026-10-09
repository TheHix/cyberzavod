// Shared format predicates: records and project cards come from outside and are checked alike.
// Not exported from the package.

/**
 * Checks that a value is an object (not `null`): parsed JSON that can be read field by field.
 * @param {unknown} value The value to check.
 * @returns {value is Record<string, unknown>} true if it is an object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Checks that a value is a string to show on one line: in a title, in a prompt card.
 * @param {unknown} value The value to check.
 * @returns {value is string} true if the string is non-empty and has no line breaks.
 */
export function isLine(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/[\r\n]/.test(value);
}
