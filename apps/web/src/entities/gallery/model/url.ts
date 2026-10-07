import { API_PAGES, QUERY_PARAMS } from "@/shared/config/routes.ts";
import { DEFAULT_LOCALE, type Locale } from "@/shared/i18n/locale.ts";
import { localizedPath } from "@/shared/i18n/path.ts";

/** Подпись картинки бейджа в Markdown: та же строка, что печатает `cyberzavod gallery`. */
const BADGE_ALT = "Built at Cyberzavod";

function withQuery(path: string, name: string, value: string): string {
  const query = new URLSearchParams({ [name]: value });

  return `${path}?${query.toString()}`;
}

/**
 * Адрес списка открытых галерей.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/gallery/`, для русского — `/ru/gallery/`.
 */
export function galleriesUrl(locale: Locale): string {
  return localizedPath(locale, API_PAGES.galleries);
}

/**
 * Адрес открытой галереи автора.
 * @param {string} login Логин автора на GitHub.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/gallery/?user=alice`.
 */
export function galleryUrl(login: string, locale: Locale): string {
  return withQuery(galleriesUrl(locale), QUERY_PARAMS.galleryOwner, login);
}

/**
 * Адрес записи из галереи по секретной ссылке.
 * @param {string} slug Секретная часть ссылки из `Summary.slug`.
 * @param {Locale} locale Язык страницы.
 * @returns {string} Путь вида `/r/?id=k3f9x2m1q8zt`.
 */
export function sharedRecordingUrl(slug: string, locale: Locale): string {
  const page = localizedPath(locale, API_PAGES.sharedRecording);

  return withQuery(page, QUERY_PARAMS.recording, slug);
}

/**
 * Адрес картинки бейджа автора: её отдаёт API.
 * @param {string} login Логин автора на GitHub.
 * @returns {string} Путь вида `/api/badges/alice.svg`.
 */
export function badgeImageUrl(login: string): string {
  return `/api/badges/${encodeURIComponent(login)}.svg`;
}

/**
 * Строка Markdown для README: бейдж со ссылкой на галерею автора. Адреса абсолютные — README
 * лежит на чужом сайте; галерея — на языке по умолчанию, как у всех внешних ссылок на сайт.
 * @param {string} login Логин автора на GitHub.
 * @param {string} siteUrl Адрес сайта — `site` из конфига Astro.
 * @returns {string} Строка вида `[![Built at Cyberzavod](…/api/badges/alice.svg)](…/gallery/?user=alice)`.
 */
export function badgeMarkdown(login: string, siteUrl: string): string {
  const image = new URL(badgeImageUrl(login), siteUrl);
  const gallery = new URL(galleryUrl(login, DEFAULT_LOCALE), siteUrl);

  return `[![${BADGE_ALT}](${image.href})](${gallery.href})`;
}

/**
 * Читает из параметров адреса значение для страницы из галереи: slug записи или логин автора.
 * @param {string} search Параметры адреса — `location.search`.
 * @param {keyof typeof QUERY_PARAMS} param Какой параметр нужен.
 * @returns {string | undefined} Значение или `undefined`, если параметра нет или он пустой.
 */
export function queryParamOf(search: string, param: keyof typeof QUERY_PARAMS): string | undefined {
  const value = new URLSearchParams(search).get(QUERY_PARAMS[param]);

  return value === null || value === "" ? undefined : value;
}
