/**
 * Адрес страницы гайда на сайте.
 * @param {string} id Идентификатор гайда.
 * @returns {string} Путь вида `/guides/connect-project/`.
 */
export function guideUrl(id: string): string {
  return `/guides/${id}/`;
}
