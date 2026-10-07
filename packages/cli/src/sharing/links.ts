// Ссылки на страницы сайта, которые CLI показывает человеку.

// Подпись бейджа — та же, что в строке Markdown на странице галереи на сайте.
const BADGE_ALT = "Built at Cyberzavod";

/**
 * Секретная ссылка на запись: работает и в закрытой галерее.
 * @param {string} siteUrl Адрес сервера без завершающего «/».
 * @param {string} slug Случайный идентификатор записи на сервере.
 * @returns {string} Ссылка на страницу записи.
 */
export function recordingLink(siteUrl: string, slug: string): string {
  return `${siteUrl}/r/?id=${encodeURIComponent(slug)}`;
}

/**
 * Страница галереи автора.
 * @param {string} siteUrl Адрес сервера без завершающего «/».
 * @param {string} login Логин автора на GitHub.
 * @returns {string} Ссылка на галерею.
 */
export function galleryLink(siteUrl: string, login: string): string {
  return `${siteUrl}/gallery/?user=${encodeURIComponent(login)}`;
}

/**
 * Бейдж галереи для README в разметке Markdown: картинка со ссылкой на галерею.
 * @param {string} siteUrl Адрес сервера без завершающего «/».
 * @param {string} login Логин автора на GitHub.
 * @returns {string} Строка Markdown.
 */
export function badgeMarkdown(siteUrl: string, login: string): string {
  const badge = `${siteUrl}/api/badges/${encodeURIComponent(login)}.svg`;

  return `[![${BADGE_ALT}](${badge})](${galleryLink(siteUrl, login)})`;
}
