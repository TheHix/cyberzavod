/**
 * Adds the current page's query parameters to a link address, replacing the link's own.
 * @param {string} href Link address from the root: `/ru/r/`.
 * @param {string} search Current page parameters, `location.search`: `?id=abc`.
 * @returns {string} Address with parameters: `/ru/r/?id=abc`; the link's anchor is kept.
 */
export function withSearch(href: string, search: string): string {
  const [path = "", fragment] = href.split("#", 2);
  const [pathname = ""] = path.split("?", 1);
  const anchor = fragment === undefined ? "" : `#${fragment}`;

  return `${pathname}${search}${anchor}`;
}
