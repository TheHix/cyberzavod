/**
 * Адрес страницы проекта на сайте.
 * @param {string} id Идентификатор проекта.
 * @returns {string} Путь вида `/projects/cyberzavod/`.
 */
export function projectUrl(id: string): string {
  return `/projects/${id}/`;
}
