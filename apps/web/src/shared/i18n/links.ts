import type { Locale } from "./locale.ts";
import { localizedPath, pathWithoutLocale } from "./path.ts";

// Атрибут ищется только внутри открывающего тега `<a …>`: в тексте блоков кода `<` экранирован
// как `&lt;`, а кавычки нет, поэтому ` href="` в примере кода тегом не считается.
const ANCHOR_HREF = /(<a\b[^>]*?\shref=")([^"]*)(")/g;
const QUERY_OR_FRAGMENT = /[?#]/;
// Файлы (`/favicon.svg`, `/files/a.pdf`) не локализуются: у них одна версия на все языки.
const FILE_EXTENSION = /\.[^/.]+$/;

/**
 * Переводит ссылку на страницу этого же сайта на язык страницы: содержимое, написанное один
 * раз (гайды, карточки проектов), не знает, на каком языке его покажут. Чужие адреса, якоря
 * и ссылки, где язык уже указан, остаются как есть.
 * @param {string} href Адрес из содержимого: `/projects/x/`, `https://cyberzavod.com/` или внешний.
 * @param {Locale} locale Язык страницы, на которой стоит ссылка.
 * @param {string} origin Адрес сайта: `https://cyberzavod.com`.
 * @returns {string} Адрес на языке страницы.
 */
export function localizeHref(href: string, locale: Locale, origin: string): string {
  const host = origin.replace(/\/$/, "");
  const isOwnSite = href === host || href.startsWith(`${host}/`);
  const path = isOwnSite ? href.slice(host.length) || "/" : href;
  const pathname = path.split(QUERY_OR_FRAGMENT, 1)[0] ?? path;
  const isSitePath = pathname.startsWith("/") && !pathname.startsWith("//");

  const isFile = FILE_EXTENSION.test(pathname);
  const hasLocale = pathWithoutLocale(pathname) !== pathname;

  if (!isSitePath || isFile || hasLocale) return href;

  const localized = localizedPath(locale, path);

  if (localized === path) return href;

  return isOwnSite ? `${host}${localized}` : localized;
}

/**
 * Переводит на язык страницы все ссылки на этот же сайт в готовой разметке.
 * @param {string} html Разметка содержимого, например гайда.
 * @param {Locale} locale Язык страницы, на которой стоит содержимое.
 * @param {string} origin Адрес сайта: `https://cyberzavod.com`.
 * @returns {string} Разметка со ссылками на языке страницы.
 */
export function localizeLinks(html: string, locale: Locale, origin: string): string {
  return html.replace(
    ANCHOR_HREF,
    (_attribute, before: string, href: string, after: string) =>
      `${before}${localizeHref(href, locale, origin)}${after}`,
  );
}
