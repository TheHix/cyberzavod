/**
 * Адрес полной записи сайта в JSON: файл, который сайт собирает из журнала при сборке
 * (`src/pages/recordings/[id].json.ts`). Он один на все языки: запись не переводится.
 * @param {string} id id записи — имя файла в журнале.
 * @returns {string} Путь от корня сайта: `/recordings/<id>.json`.
 */
export function recordingFileUrl(id: string): string {
  return `/recordings/${encodeURIComponent(id)}.json`;
}
