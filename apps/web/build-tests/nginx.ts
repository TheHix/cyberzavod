// Что nginx сайта отдаёт вместо несуществующих страниц: тесты сборки сверяют это с `dist/`.

// Блок `map … $not_found_page { … }` и его строки `<условие> <файл>;`.
const NOT_FOUND_MAP = /map\s+\S+\s+\$not_found_page\s*\{([^}]*)\}/;
const MAP_ENTRY = /^\s*\S+\s+(\S+);/gm;

/**
 * Находит файлы страниц «не найдено», на которые nginx отправляет неизвестные адреса.
 * @param {string} config Текст `nginx.conf`.
 * @returns {string[]} Адреса файлов от корня сайта: `/404.html`, `/ru/404/index.html`.
 * @throws {Error} Если в конфиге нет блока `map` для `$not_found_page`.
 */
export function notFoundFilesOf(config: string): string[] {
  const [, entries] = NOT_FOUND_MAP.exec(config) ?? [];
  if (entries === undefined) throw new Error("в nginx.conf нет map для $not_found_page");
  return [...entries.matchAll(MAP_ENTRY)].map(([, file = ""]) => file);
}
