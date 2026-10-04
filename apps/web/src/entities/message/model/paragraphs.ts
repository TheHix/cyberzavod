// Абзацы полного текста реплики разделены пустой строкой.
const PARAGRAPH_BREAK = /\n\s*\n/;

/**
 * Делит полный текст реплики на абзацы по пустым строкам.
 * @param {string} text Полный текст реплики.
 * @returns {string[]} Непустые абзацы без пробелов по краям; переводы строк внутри абзаца остаются.
 */
export function paragraphsOf(text: string): string[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}
