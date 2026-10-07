// Картинки сайта (иконки, превью ссылок) собираются при сборке, где нет `getComputedStyle`,
// поэтому их краски читаются прямо из текста tokens.css.

/** Откуда читаются токены — как у `CSSStyleDeclaration`: пустая строка, если токена нет. */
export interface TokenSource {
  getPropertyValue(name: string): string;
}

const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;

/**
 * Читает объявления пользовательских свойств из текста CSS. Берётся первое объявление каждого
 * токена — из `:root`: переопределения ниже (медиазапросы движения) краски не трогают.
 * @param {string} css Текст таблицы стилей с токенами.
 * @returns {TokenSource} Значения токенов по имени.
 */
export function readCssTokens(css: string): TokenSource {
  const values = new Map<string, string>();
  for (const [, name = "", value = ""] of css.matchAll(DECLARATION)) {
    if (!values.has(name)) values.set(name, value.trim());
  }
  return { getPropertyValue: (name) => values.get(name) ?? "" };
}
