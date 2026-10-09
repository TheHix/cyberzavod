import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale.ts";

// Languages with a prefix in the address: the default language's pages live at the root.
const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/**
 * Page address in a language: for the default language the path stays as is, for the others it
 * gets the language prefix.
 * @param {Locale} locale Page language.
 * @param {string} path Language-free path with a leading "/": `/recordings/x/` or `/`.
 * @returns {string} A path like `/recordings/x/` or `/ru/recordings/x/`.
 */
export function localizedPath(locale: Locale, path: string): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/**
 * Strips the language prefix from an address. Only a whole segment is stripped: `/russia/` stays.
 * @param {string} pathname Page path, for example `Astro.url.pathname`.
 * @returns {string} Language-free path: `/ru/` gives `/`, `/ru/recordings/x/` gives
 * `/recordings/x/`.
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
 * Value of the `lang` parameter in `getStaticPaths` for the `[...lang]` route: the default language
 * has no parameter, and its page lives at the root.
 * @param {Locale} locale Page language.
 * @returns {Locale | undefined} Language code, or `undefined` for the default language.
 */
export function localeParam(locale: Locale): Locale | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale;
}
