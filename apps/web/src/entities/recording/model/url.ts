/**
 * Адрес страницы записи на сайте.
 * @param {string} id Идентификатор записи.
 * @returns {string} Путь вида `/recordings/2026-10-04-744e7547/`.
 */
export function recordingUrl(id: string): string {
  return `/recordings/${id}/`;
}
