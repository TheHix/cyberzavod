/**
 * Добавляет к адресу ссылки параметры запроса текущей страницы, заменяя её собственные.
 * @param {string} href Адрес ссылки от корня: `/ru/r/`.
 * @param {string} search Параметры текущей страницы — `location.search`: `?id=abc`.
 * @returns {string} Адрес с параметрами: `/ru/r/?id=abc`; якорь ссылки сохраняется.
 */
export function withSearch(href: string, search: string): string {
  const [path = "", fragment] = href.split("#", 2);
  const [pathname = ""] = path.split("?", 1);
  const anchor = fragment === undefined ? "" : `#${fragment}`;

  return `${pathname}${search}${anchor}`;
}
