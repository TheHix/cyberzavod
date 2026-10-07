// Проверки собранного сайта: страницы, ссылки между ними, языковые версии и карта сайта. Читают
// готовый `dist/`, поэтому ловят то, чего не видно в исходниках: страницу, которой нет на одном из
// языков, ссылку мимо языка, страницу вне карты сайта.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../src/shared/i18n/locale.ts";
import { localizedPath, pathWithoutLocale } from "../src/shared/i18n/path.ts";

/** Собранный сайт: страницы, остальные файлы и карта сайта. */
export interface BuiltSite {
  /** Адрес сайта без слэша на конце: по нему внутренние ссылки отличаются от внешних. */
  readonly origin: string;
  /** Страницы: адрес вида `/ru/recordings/x/` → HTML. */
  readonly pages: ReadonlyMap<string, string>;
  /** Адреса всех файлов сайта, включая файлы страниц: `/_astro/x.css`, `/sitemap-0.xml`. */
  readonly files: ReadonlySet<string>;
  /** XML всех файлов карты сайта, одним текстом. */
  readonly sitemap: string;
}

const HTML_EXTENSION = ".html";
const PAGE_FILE = "index.html";
const SITEMAP_FILE = /^sitemap-\d+\.xml$/;
// Атрибуты тега: `имя="значение"`, `имя='значение'`, `имя=значение` или одно имя.
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const SITEMAP_LOCATION = /<loc>([^<]+)<\/loc>/g;

type Tag = Readonly<Record<string, string>>;

function urlOfFile(relativePath: string): string {
  return `/${relativePath.split("\\").join("/")}`;
}

/**
 * Адрес страницы по адресу её файла: `index.html` каталога — сам каталог, другой HTML — как есть.
 * @param {string} fileUrl Адрес файла от корня сайта: `/ru/404/index.html`, `/404.html`.
 * @returns {string | undefined} Адрес страницы: `/ru/404/`, `/404.html`; `undefined`, если это не HTML.
 */
export function pageUrlOf(fileUrl: string): string | undefined {
  if (fileUrl.endsWith(`/${PAGE_FILE}`)) return fileUrl.slice(0, -PAGE_FILE.length);
  return fileUrl.endsWith(HTML_EXTENSION) ? fileUrl : undefined;
}

/**
 * Читает собранный сайт из каталога сборки.
 * @param {string} distDir Каталог сборки, например `dist`.
 * @param {string} origin Адрес сайта: `https://cyberzavod.com`.
 * @returns {BuiltSite} Страницы, файлы и карта сайта.
 */
export function readBuiltSite(distDir: string, origin: string): BuiltSite {
  const fileUrls = readdirSync(distDir, { recursive: true, encoding: "utf8" })
    .filter((relativePath) => statSync(join(distDir, relativePath)).isFile())
    .map(urlOfFile);
  const pages = new Map<string, string>();
  for (const fileUrl of fileUrls) {
    const pageUrl = pageUrlOf(fileUrl);
    if (pageUrl !== undefined) pages.set(pageUrl, readFileSync(join(distDir, fileUrl), "utf8"));
  }
  const sitemap = fileUrls
    .filter((fileUrl) => SITEMAP_FILE.test(fileUrl.slice(1)))
    .map((fileUrl) => readFileSync(join(distDir, fileUrl), "utf8"))
    .join("\n");
  return { origin: origin.replace(/\/$/, ""), pages, files: new Set(fileUrls), sitemap };
}

// Теги с таким именем со всеми их атрибутами; значение без `=` — пустая строка.
function tagsOf(html: string, name: string): Tag[] {
  const opening = new RegExp(`<${name}(?=[\\s/>])([^>]*)>`, "gi");
  return [...html.matchAll(opening)].map(([, attributes = ""]) =>
    Object.fromEntries(
      [...attributes.matchAll(ATTRIBUTE)].map(([, key = "", quoted, single, bare]) => [
        key.toLowerCase(),
        quoted ?? single ?? bare ?? "",
      ]),
    ),
  );
}

/**
 * Проверяет, открыта ли страница поисковикам: страница с `<meta name="robots" content="noindex">`
 * (например, «не найдено») не входит в карту сайта и не имеет своего адреса для `canonical`.
 * @param {string} html Разметка страницы.
 * @returns {boolean} `true`, если у страницы нет `noindex`.
 */
export function isIndexed(html: string): boolean {
  return !tagsOf(html, "meta").some(
    (tag) =>
      tag["name"] === "robots" &&
      (tag["content"] ?? "").split(",").some((directive) => directive.trim() === "noindex"),
  );
}

/**
 * Определяет язык страницы по её адресу.
 * @param {string} pageUrl Адрес страницы: `/recordings/x/` или `/ru/recordings/x/`.
 * @returns {Locale | undefined} Язык страницы или `undefined`, если адрес не принадлежит ни одному языку.
 */
export function localeOfPage(pageUrl: string): Locale | undefined {
  const bare = pathWithoutLocale(pageUrl);
  return LOCALES.find((locale) => localizedPath(locale, bare) === pageUrl);
}

// Путь, на который ведёт ссылка со страницы; `undefined` — ссылка не на этот сайт (внешний адрес,
// `mailto:`). Ссылка-якорь ведёт на саму страницу.
function internalTarget(site: BuiltSite, pageUrl: string, href: string): string | undefined {
  const url = new URL(href, `${site.origin}${pageUrl}`);
  return url.origin === site.origin ? decodeURIComponent(url.pathname) : undefined;
}

interface PageLink {
  readonly pageUrl: string;
  readonly target: string;
  readonly tag: Tag;
}

function internalLinks(site: BuiltSite): PageLink[] {
  return [...site.pages].flatMap(([pageUrl, html]) =>
    [...tagsOf(html, "a"), ...tagsOf(html, "link")].flatMap((tag) => {
      const target =
        tag["href"] === undefined ? undefined : internalTarget(site, pageUrl, tag["href"]);
      return target === undefined ? [] : [{ pageUrl, target, tag }];
    }),
  );
}

function exists(site: BuiltSite, target: string): boolean {
  return site.pages.has(target) || site.files.has(target);
}

/**
 * Находит внутренние ссылки (`<a href>` и `<link href>`), которые никуда не ведут.
 * @param {BuiltSite} site Собранный сайт.
 * @returns {string[]} Описания сломанных ссылок; пусто, если все ведут на страницы или файлы.
 */
export function brokenLinks(site: BuiltSite): string[] {
  return internalLinks(site)
    .filter(({ target }) => !exists(site, target))
    .map(({ pageUrl, target }) => `${pageUrl}: ссылка на ${target}, которой нет`);
}

function missingAlternatesOf(site: BuiltSite, pageUrl: string, html: string): string[] {
  const locale = localeOfPage(pageUrl);
  if (locale === undefined) return [`${pageUrl}: язык страницы не определить по адресу`];
  const problems: string[] = [];
  const [root] = tagsOf(html, "html");
  if (root?.["lang"] !== locale) {
    problems.push(`${pageUrl}: <html lang="${root?.["lang"] ?? ""}"> вместо «${locale}»`);
  }
  if (!isIndexed(html)) return problems;
  const links = tagsOf(html, "link");
  const canonical = links.find((tag) => tag["rel"] === "canonical");
  if (canonical?.["href"] !== `${site.origin}${pageUrl}`) {
    problems.push(
      `${pageUrl}: canonical ${canonical?.["href"] ?? "отсутствует"}, а не сама страница`,
    );
  }
  const bare = pathWithoutLocale(pageUrl);
  const expected = [
    ...LOCALES.map((alternate) => [alternate, localizedPath(alternate, bare)] as const),
    ["x-default", localizedPath(DEFAULT_LOCALE, bare)] as const,
  ];
  for (const [hreflang, target] of expected) {
    const alternate = links.find(
      (tag) => tag["rel"] === "alternate" && tag["hreflang"] === hreflang,
    );
    if (alternate === undefined) {
      problems.push(`${pageUrl}: нет hreflang="${hreflang}"`);
    } else if (alternate["href"] !== `${site.origin}${target}`) {
      problems.push(
        `${pageUrl}: hreflang="${hreflang}" ведёт на ${alternate["href"] ?? ""}, а не на ${target}`,
      );
    } else if (!site.pages.has(target)) {
      problems.push(`${pageUrl}: hreflang="${hreflang}" ведёт на ${target}, которой нет`);
    }
  }
  return problems;
}

/**
 * Находит страницы без правильной языковой разметки: `<html lang>`, `canonical` на саму себя
 * и `hreflang` на каждый язык и `x-default`, ведущие на существующие страницы. Страница без
 * версии на другом языке тоже попадает сюда: её `hreflang` ведёт в пустоту. У страницы
 * с `noindex` проверяется только `<html lang>`: своего адреса у неё нет.
 * @param {BuiltSite} site Собранный сайт.
 * @returns {string[]} Описания недостающей или неверной разметки; пусто, если всё на месте.
 */
export function missingAlternates(site: BuiltSite): string[] {
  return [...site.pages].flatMap(([pageUrl, html]) => missingAlternatesOf(site, pageUrl, html));
}

/**
 * Находит ссылки без `hreflang`, которые уводят страницу на другой язык: со страницы языка они
 * должны вести на страницы того же языка. Ссылки на файлы (стили, картинки) от языка не зависят.
 * @param {BuiltSite} site Собранный сайт.
 * @returns {string[]} Описания ссылок мимо языка; пусто, если все остаются в своём языке.
 */
export function foreignLocaleLinks(site: BuiltSite): string[] {
  return internalLinks(site)
    .filter(({ tag }) => tag["hreflang"] === undefined)
    .flatMap(({ pageUrl, target }) => {
      const targetLocale = site.pages.has(target) ? localeOfPage(target) : undefined;
      return targetLocale === undefined || targetLocale === localeOfPage(pageUrl)
        ? []
        : [`${pageUrl}: ссылка на ${target} уводит на язык «${targetLocale}»`];
    });
}

function sitemapPaths(site: BuiltSite): Set<string> {
  return new Set(
    [...site.sitemap.matchAll(SITEMAP_LOCATION)].map(
      ([, location = ""]) => new URL(location).pathname,
    ),
  );
}

/**
 * Находит открытые поисковикам страницы, которых нет в карте сайта.
 * @param {BuiltSite} site Собранный сайт.
 * @returns {string[]} Адреса страниц вне карты сайта; пусто, если в ней есть все страницы.
 */
export function pagesMissingFromSitemap(site: BuiltSite): string[] {
  const listed = sitemapPaths(site);
  return [...site.pages]
    .filter(([pageUrl, html]) => isIndexed(html) && !listed.has(pageUrl))
    .map(([pageUrl]) => pageUrl);
}

/**
 * Находит в карте сайта страницы с `noindex`: поисковику незачем идти туда, где его не ждут.
 * @param {BuiltSite} site Собранный сайт.
 * @returns {string[]} Адреса закрытых страниц в карте сайта; пусто, если их там нет.
 */
export function unindexedPagesInSitemap(site: BuiltSite): string[] {
  const listed = sitemapPaths(site);
  return [...site.pages]
    .filter(([pageUrl, html]) => !isIndexed(html) && listed.has(pageUrl))
    .map(([pageUrl]) => pageUrl);
}
