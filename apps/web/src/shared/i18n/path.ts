import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale.ts";

// Языки с префиксом в адресе: страницы языка по умолчанию лежат в корне.
const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/**
 * Адрес страницы на языке: у языка по умолчанию путь остаётся как есть, у остальных получает
 * префикс языка.
 * @param {Locale} locale Язык страницы.
 * @param {string} path Путь без языка, с начальным «/»: `/recordings/x/` или `/`.
 * @returns {string} Путь вида `/recordings/x/` или `/ru/recordings/x/`.
 */
export function localizedPath(locale: Locale, path: string): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/**
 * Снимает с адреса префикс языка. Снимается только целый сегмент: `/russia/` остаётся как есть.
 * @param {string} pathname Путь страницы, например `Astro.url.pathname`.
 * @returns {string} Путь без языка: `/ru/` даёт `/`, `/ru/recordings/x/` даёт `/recordings/x/`.
 */
export function pathWithoutLocale(pathname: string): string {
  for (const locale of PREFIXED_LOCALES) {
    const prefix = `/${locale}`;
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

/**
 * Значение параметра `lang` в `getStaticPaths` для маршрута `[...lang]`: у языка по умолчанию
 * параметра нет, и страница лежит в корне.
 * @param {Locale} locale Язык страницы.
 * @returns {Locale | undefined} Код языка или `undefined` для языка по умолчанию.
 */
export function localeParam(locale: Locale): Locale | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale;
}
