// Checks of the built site: pages, links between them, language versions and the sitemap. They read
// the finished `dist/`, so they catch what is not visible in the sources: a page missing in one
// of the languages, a link that leaves the language, a page outside the sitemap.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../src/shared/i18n/locale.ts";
import { localizedPath, pathWithoutLocale } from "../src/shared/i18n/path.ts";

/** The built site: pages, other files and the sitemap. */
export interface BuiltSite {
  /** Site address without a trailing slash: it tells internal links from external ones. */
  readonly origin: string;
  /** Pages: an address like `/ru/recordings/x/` → HTML. */
  readonly pages: ReadonlyMap<string, string>;
  /** Addresses of all site files, including page files: `/_astro/x.css`, `/sitemap-0.xml`. */
  readonly files: ReadonlySet<string>;
  /** XML of all sitemap files, as one text. */
  readonly sitemap: string;
}

const HTML_EXTENSION = ".html";
const PAGE_FILE = "index.html";
const SITEMAP_FILE = /^sitemap-\d+\.xml$/;
// Tag attributes: `name="value"`, `name='value'`, `name=value` or just a name.
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const SITEMAP_LOCATION = /<loc>([^<]+)<\/loc>/g;

type Tag = Readonly<Record<string, string>>;

function urlOfFile(relativePath: string): string {
  return `/${relativePath.split("\\").join("/")}`;
}

/**
 * Page address from its file address: a directory's `index.html` is the directory itself, other
 * HTML as is.
 * @param {string} fileUrl File address from the site root: `/ru/404/index.html`, `/404.html`.
 * @returns {string | undefined} Page address: `/ru/404/`, `/404.html`; `undefined` if not HTML.
 */
export function pageUrlOf(fileUrl: string): string | undefined {
  if (fileUrl.endsWith(`/${PAGE_FILE}`)) return fileUrl.slice(0, -PAGE_FILE.length);

  return fileUrl.endsWith(HTML_EXTENSION) ? fileUrl : undefined;
}

/**
 * Reads the built site from the build directory.
 * @param {string} distDir Build directory, e.g. `dist`.
 * @param {string} origin Site address: `https://cyberzavod.com`.
 * @returns {BuiltSite} Pages, files and the sitemap.
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

function attributesOf(attributes: string): Tag {
  const entries = [...attributes.matchAll(ATTRIBUTE)].map(([, key = "", quoted, single, bare]) => [
    key.toLowerCase(),
    quoted ?? single ?? bare ?? "",
  ]);

  return Object.fromEntries(entries);
}

// Tags with this name with all their attributes; a value without `=` is an empty string.
function tagsOf(html: string, name: string): Tag[] {
  const opening = new RegExp(`<${name}(?=[\\s/>])([^>]*)>`, "gi");

  return [...html.matchAll(opening)].map(([, attributes = ""]) => attributesOf(attributes));
}

function isNoindexTag(tag: Tag): boolean {
  const directives = (tag["content"] ?? "").split(",").map((directive) => directive.trim());

  return tag["name"] === "robots" && directives.includes("noindex");
}

/**
 * Checks whether a page is open to search engines: a page with
 * `<meta name="robots" content="noindex">`
 * (e.g. "not found") is not in the sitemap and has no address of its own for `canonical`.
 * @param {string} html Page markup.
 * @returns {boolean} `true` if the page has no `noindex`.
 */
export function isIndexed(html: string): boolean {
  return !tagsOf(html, "meta").some(isNoindexTag);
}

/**
 * Determines a page's language from its address.
 * @param {string} pageUrl Page address: `/recordings/x/` or `/ru/recordings/x/`.
 * @returns {Locale | undefined} Page language, or `undefined` if the address has no language.
 */
export function localeOfPage(pageUrl: string): Locale | undefined {
  const bare = pathWithoutLocale(pageUrl);

  return LOCALES.find((locale) => localizedPath(locale, bare) === pageUrl);
}

// The path a link on a page leads to; `undefined` means the link is not to this site (an external
// address, `mailto:`). An anchor link leads to the page itself.
function internalTarget(site: BuiltSite, pageUrl: string, href: string): string | undefined {
  const url = new URL(href, `${site.origin}${pageUrl}`);

  return url.origin === site.origin ? decodeURIComponent(url.pathname) : undefined;
}

interface PageLink {
  readonly pageUrl: string;
  readonly target: string;
  readonly tag: Tag;
}

function internalLinksOfPage(site: BuiltSite, pageUrl: string, html: string): PageLink[] {
  const tags = [...tagsOf(html, "a"), ...tagsOf(html, "link")];

  return tags.flatMap((tag) => {
    if (tag["href"] === undefined) return [];

    const target = internalTarget(site, pageUrl, tag["href"]);

    return target === undefined ? [] : [{ pageUrl, target, tag }];
  });
}

function internalLinks(site: BuiltSite): PageLink[] {
  return [...site.pages].flatMap(([pageUrl, html]) => internalLinksOfPage(site, pageUrl, html));
}

function exists(site: BuiltSite, target: string): boolean {
  return site.pages.has(target) || site.files.has(target);
}

/**
 * Finds internal links (`<a href>` and `<link href>`) that lead nowhere.
 * @param {BuiltSite} site The built site.
 * @returns {string[]} Descriptions of broken links; empty if all lead to pages or files.
 */
export function brokenLinks(site: BuiltSite): string[] {
  return internalLinks(site)
    .filter(({ target }) => !exists(site, target))
    .map(({ pageUrl, target }) => `${pageUrl}: ссылка на ${target}, которой нет`);
}

function langProblems(pageUrl: string, html: string, locale: Locale): string[] {
  const [root] = tagsOf(html, "html");

  if (root?.["lang"] === locale) return [];

  return [`${pageUrl}: <html lang="${root?.["lang"] ?? ""}"> вместо «${locale}»`];
}

function canonicalProblems(site: BuiltSite, pageUrl: string, links: readonly Tag[]): string[] {
  const canonical = links.find((tag) => tag["rel"] === "canonical");

  if (canonical?.["href"] === `${site.origin}${pageUrl}`) return [];

  return [`${pageUrl}: canonical ${canonical?.["href"] ?? "отсутствует"}, а не сама страница`];
}

function alternateProblem(
  site: BuiltSite,
  pageUrl: string,
  links: readonly Tag[],
  [hreflang, target]: readonly [string, string],
): string | undefined {
  const alternate = links.find((tag) => tag["rel"] === "alternate" && tag["hreflang"] === hreflang);

  if (alternate === undefined) return `${pageUrl}: нет hreflang="${hreflang}"`;
  if (alternate["href"] !== `${site.origin}${target}`) {
    return `${pageUrl}: hreflang="${hreflang}" ведёт на ${alternate["href"] ?? ""}, а не на ${target}`;
  }
  if (!site.pages.has(target)) {
    return `${pageUrl}: hreflang="${hreflang}" ведёт на ${target}, которой нет`;
  }

  return undefined;
}

function alternatesProblems(site: BuiltSite, pageUrl: string, links: readonly Tag[]): string[] {
  const bare = pathWithoutLocale(pageUrl);
  const expected = [
    ...LOCALES.map((alternate) => [alternate, localizedPath(alternate, bare)] as const),
    ["x-default", localizedPath(DEFAULT_LOCALE, bare)] as const,
  ];

  return expected
    .map((entry) => alternateProblem(site, pageUrl, links, entry))
    .filter((problem) => problem !== undefined);
}

function missingAlternatesOf(site: BuiltSite, pageUrl: string, html: string): string[] {
  const locale = localeOfPage(pageUrl);

  if (locale === undefined) return [`${pageUrl}: язык страницы не определить по адресу`];

  const problems = langProblems(pageUrl, html, locale);

  if (!isIndexed(html)) return problems;

  const links = tagsOf(html, "link");

  return [
    ...problems,
    ...canonicalProblems(site, pageUrl, links),
    ...alternatesProblems(site, pageUrl, links),
  ];
}

/**
 * Finds pages without correct language markup: `<html lang>`, a `canonical` to itself
 * and an `hreflang` for each language and `x-default`, leading to existing pages. A page without
 * a version in another language also lands here: its `hreflang` leads nowhere. For a page
 * with `noindex` only `<html lang>` is checked: it has no address of its own.
 * @param {BuiltSite} site The built site.
 * @returns {string[]} Descriptions of missing or wrong markup; empty if everything is in place.
 */
export function missingAlternates(site: BuiltSite): string[] {
  return [...site.pages].flatMap(([pageUrl, html]) => missingAlternatesOf(site, pageUrl, html));
}

/**
 * Finds links without `hreflang` that take a page to another language: from a language's page they
 * must lead to pages of the same language. Links to files (styles, images) do not depend on
 * language.
 * @param {BuiltSite} site The built site.
 * @returns {string[]} Descriptions of links that leave the language; empty if all stay in it.
 */
export function foreignLocaleLinks(site: BuiltSite): string[] {
  return internalLinks(site)
    .filter(({ tag }) => tag["hreflang"] === undefined)
    .flatMap(({ pageUrl, target }) => {
      const targetLocale = site.pages.has(target) ? localeOfPage(target) : undefined;
      const isForeign = targetLocale !== undefined && targetLocale !== localeOfPage(pageUrl);

      return isForeign ? [`${pageUrl}: ссылка на ${target} уводит на язык «${targetLocale}»`] : [];
    });
}

function sitemapPaths(site: BuiltSite): Set<string> {
  const locations = [...site.sitemap.matchAll(SITEMAP_LOCATION)].map(
    ([, location = ""]) => location,
  );

  return new Set(locations.map((location) => new URL(location).pathname));
}

/**
 * Finds pages open to search engines that are missing from the sitemap.
 * @param {BuiltSite} site The built site.
 * @returns {string[]} Addresses of pages outside the sitemap; empty if it has all the pages.
 */
export function pagesMissingFromSitemap(site: BuiltSite): string[] {
  const listed = sitemapPaths(site);

  return [...site.pages]
    .filter(([pageUrl, html]) => isIndexed(html) && !listed.has(pageUrl))
    .map(([pageUrl]) => pageUrl);
}

/**
 * Finds `noindex` pages in the sitemap: a search engine has no reason to go where it is not wanted.
 * @param {BuiltSite} site The built site.
 * @returns {string[]} Addresses of closed pages in the sitemap; empty if there are none.
 */
export function unindexedPagesInSitemap(site: BuiltSite): string[] {
  const listed = sitemapPaths(site);

  return [...site.pages]
    .filter(([pageUrl, html]) => !isIndexed(html) && listed.has(pageUrl))
    .map(([pageUrl]) => pageUrl);
}
