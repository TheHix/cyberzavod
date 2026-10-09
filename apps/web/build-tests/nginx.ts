// What the site's nginx serves instead of nonexistent pages: build tests check it against `dist/`.

// The `map … $not_found_page { … }` block and its `<condition> <file>;` lines.
const NOT_FOUND_MAP = /map\s+\S+\s+\$not_found_page\s*\{([^}]*)\}/;
const MAP_ENTRY = /^\s*\S+\s+(\S+);/gm;

/**
 * Finds the "not found" page files nginx sends unknown addresses to.
 * @param {string} config `nginx.conf` text.
 * @returns {string[]} File addresses from the site root: `/404.html`, `/ru/404/index.html`.
 * @throws {Error} If the config has no `map` block for `$not_found_page`.
 */
export function notFoundFilesOf(config: string): string[] {
  const [, entries] = NOT_FOUND_MAP.exec(config) ?? [];

  if (entries === undefined) throw new Error("в nginx.conf нет map для $not_found_page");

  return [...entries.matchAll(MAP_ENTRY)].map(([, file = ""]) => file);
}
