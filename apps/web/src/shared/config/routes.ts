// Адреса страниц, которые собираются из ответов API в браузере. Файл без импортов с алиасами: его
// читает и `astro.config.ts` — фильтр карты сайта.

/**
 * Пути страниц без языка, данные которых приходят из API в браузере: страница одна на все
 * галереи и записи, а что показывать — в параметрах запроса.
 */
export const API_PAGES = {
  sharedRecording: "/r/",
  galleries: "/gallery/",
  stats: "/stats/",
} as const;

/** Имена параметров запроса у страниц из `API_PAGES`. */
export const QUERY_PARAMS = {
  /** Секретный slug записи из галереи: `/r/?id=<slug>`. */
  recording: "id",
  /** Логин автора открытой галереи: `/gallery/?user=<login>`. */
  galleryOwner: "user",
} as const;

// Запись из галереи видна только по секретной ссылке: поисковикам её страница не нужна, а без
// параметра запроса на ней ничего нет.
const UNINDEXED_PATHS: readonly string[] = [API_PAGES.sharedRecording];

/**
 * Закрыта ли страница от поисковиков: такая страница получает `noindex` и не попадает в карту
 * сайта.
 * @param {string} path Путь страницы без языка: `/r/`, `/gallery/`.
 * @returns {boolean} `true`, если страницу не индексируют.
 */
export function isUnindexedPath(path: string): boolean {
  return UNINDEXED_PATHS.includes(path);
}
