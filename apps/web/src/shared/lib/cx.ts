/**
 * Склеивает CSS-классы, пропуская выключенные: `cx(styles.button, active && styles.active)`.
 * @param {(string | false | null | undefined)[]} classes Классы и условия.
 * @returns {string} Классы через пробел.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
