/**
 * Joins CSS classes, skipping the disabled ones: `cx(styles.button, active && styles.active)`.
 * @param {(string | false | null | undefined)[]} classes Classes and conditions.
 * @returns {string} Space-separated classes.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
