import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../src/shared/i18n/locale.ts";
import { localizedPath, pathWithoutLocale } from "../src/shared/i18n/path.ts";
import {
  brokenLinks,
  foreignLocaleLinks,
  localeOfPage,
  missingAlternates,
  pagesMissingFromSitemap,
  unindexedPagesInSitemap,
  type BuiltSite,
} from "./built-site.ts";

const ORIGIN = "https://example.test";
const PAGE_PATHS = ["/", "/recordings/a/"];

interface PageOptions {
  /** Язык в `<html lang>`; по умолчанию правильный. */
  readonly lang?: string;
  /** Адрес в `canonical`; по умолчанию сама страница. */
  readonly canonical?: string;
  /** Языки, для которых `hreflang` не пишется. */
  readonly withoutHreflang?: readonly string[];
  /** Дополнительная разметка в теле страницы. */
  readonly body?: string;
  /** Страница закрыта от поисковиков, как «не найдено»: вместо canonical и hreflang — noindex. */
  readonly noindex?: boolean;
}

// Страницы теста — всегда адреса одного из языков.
function localeOf(pageUrl: string): Locale {
  return localeOfPage(pageUrl) ?? DEFAULT_LOCALE;
}

function pageHtml(pageUrl: string, options: PageOptions = {}): string {
  const bare = pathWithoutLocale(pageUrl);
  const alternates = [
    ...LOCALES.map((locale) => [locale, localizedPath(locale, bare)] as const),
    ["x-default", localizedPath(DEFAULT_LOCALE, bare)] as const,
  ]
    .filter(([hreflang]) => !(options.withoutHreflang ?? []).includes(hreflang))
    .map(
      ([hreflang, path]) => `<link rel="alternate" hreflang="${hreflang}" href="${ORIGIN}${path}">`,
    );
  const canonical = options.canonical ?? `${ORIGIN}${pageUrl}`;
  const head =
    options.noindex === true
      ? ['<meta name="robots" content="noindex">']
      : [`<link rel="canonical" href="${canonical}">`, ...alternates];

  return [
    `<!DOCTYPE html><html lang="${options.lang ?? localeOf(pageUrl)}"><head>`,
    ...head,
    `<link rel="stylesheet" href="/_astro/app.css"></head><body>`,
    `<a href="${localizedPath(localeOf(pageUrl), "/")}">home</a>`,
    options.body ?? "",
    `</body></html>`,
  ].join("");
}

// Сайт из страниц обоих языков: у каждой верная разметка, ссылки остаются в своём языке, и все
// страницы есть в карте сайта.
function validSite(overrides: Readonly<Record<string, string>> = {}): BuiltSite {
  const pageUrls = LOCALES.flatMap((locale) =>
    PAGE_PATHS.map((path) => localizedPath(locale, path)),
  );
  const pageEntries = pageUrls.map((pageUrl) => [pageUrl, pageHtml(pageUrl)] as const);
  const pages = new Map(pageEntries);

  for (const [pageUrl, html] of Object.entries(overrides)) pages.set(pageUrl, html);

  const pageFiles = [...pages.keys()].map((pageUrl) => `${pageUrl}index.html`);
  const files = new Set(["/_astro/app.css", ...pageFiles]);
  const locations = pageUrls.map((pageUrl) => `<url><loc>${ORIGIN}${pageUrl}</loc></url>`);
  const sitemap = `<urlset>${locations.join("")}</urlset>`;

  return { origin: ORIGIN, pages, files, sitemap };
}

function withoutPage(site: BuiltSite, pageUrl: string): BuiltSite {
  const pages = new Map(site.pages);

  pages.delete(pageUrl);

  return { ...site, pages };
}

describe("localeOfPage", () => {
  it.each([
    ["/", "en"],
    ["/recordings/a/", "en"],
    ["/ru/", "ru"],
    ["/ru/recordings/a/", "ru"],
    ["/russia/", "en"],
  ] as const)("определяет язык страницы %s как %s", (pageUrl, expected) => {
    const locale = localeOfPage(pageUrl);

    expect(locale).toBe(expected);
  });
});

describe("brokenLinks", () => {
  it("не находит ничего на целом сайте", () => {
    const site = validSite();

    const problems = brokenLinks(site);

    expect(problems).toEqual([]);
  });

  it("находит ссылку на страницу, которой нет", () => {
    const site = validSite({ "/": pageHtml("/", { body: '<a href="/missing/">x</a>' }) });

    const problems = brokenLinks(site);

    expect(problems).toEqual(["/: ссылка на /missing/, которой нет"]);
  });

  it("находит абсолютную ссылку на свой сайт, которая никуда не ведёт", () => {
    const site = validSite({
      "/": pageHtml("/", { body: `<a href="${ORIGIN}/ru/missing/">x</a>` }),
    });

    const problems = brokenLinks(site);

    expect(problems).toEqual(["/: ссылка на /ru/missing/, которой нет"]);
  });

  it("находит ссылку на файл, которого нет", () => {
    const site = validSite({
      "/": pageHtml("/", { body: '<link rel="stylesheet" href="/_astro/gone.css">' }),
    });

    const problems = brokenLinks(site);

    expect(problems).toEqual(["/: ссылка на /_astro/gone.css, которой нет"]);
  });

  it("разбирает относительные ссылки от адреса страницы", () => {
    const site = validSite({
      "/recordings/a/": pageHtml("/recordings/a/", { body: '<a href="../../">x</a>' }),
    });

    const problems = brokenLinks(site);

    expect(problems).toEqual([]);
  });

  it("пропускает внешние ссылки, якоря и почту", () => {
    const body =
      '<a href="https://other.test/x">a</a><a href="#top">b</a><a href="mailto:a@b.test">c</a>';
    const site = validSite({ "/": pageHtml("/", { body }) });

    const problems = brokenLinks(site);

    expect(problems).toEqual([]);
  });
});

describe("missingAlternates", () => {
  it("не находит ничего на целом сайте", () => {
    const site = validSite();

    const problems = missingAlternates(site);

    expect(problems).toEqual([]);
  });

  it("находит неверный язык в <html lang>", () => {
    const site = validSite({ "/ru/": pageHtml("/ru/", { lang: "en" }) });

    const problems = missingAlternates(site);

    expect(problems).toEqual(['/ru/: <html lang="en"> вместо «ru»']);
  });

  it("находит canonical не на саму страницу", () => {
    const site = validSite({ "/": pageHtml("/", { canonical: `${ORIGIN}/ru/` }) });

    const problems = missingAlternates(site);

    expect(problems).toEqual([`/: canonical ${ORIGIN}/ru/, а не сама страница`]);
  });

  it("находит страницу без hreflang на x-default", () => {
    const site = validSite({ "/": pageHtml("/", { withoutHreflang: ["x-default"] }) });

    const problems = missingAlternates(site);

    expect(problems).toEqual(['/: нет hreflang="x-default"']);
  });

  it("не требует canonical и hreflang у страницы с noindex", () => {
    const site = validSite({ "/404.html": pageHtml("/404.html", { noindex: true }) });

    const problems = missingAlternates(site);

    expect(problems).toEqual([]);
  });

  it("проверяет <html lang> у страницы с noindex", () => {
    const site = validSite({ "/ru/404/": pageHtml("/ru/404/", { noindex: true, lang: "en" }) });

    const problems = missingAlternates(site);

    expect(problems).toEqual(['/ru/404/: <html lang="en"> вместо «ru»']);
  });

  it("находит hreflang на страницу, которой нет: у страницы нет версии на другом языке", () => {
    const site = withoutPage(validSite(), "/ru/recordings/a/");

    const problems = missingAlternates(site);

    expect(problems).toEqual([
      '/recordings/a/: hreflang="ru" ведёт на /ru/recordings/a/, которой нет',
    ]);
  });
});

describe("foreignLocaleLinks", () => {
  it("не находит ничего на целом сайте", () => {
    const site = validSite();

    const problems = foreignLocaleLinks(site);

    expect(problems).toEqual([]);
  });

  it("находит ссылку русской страницы на английскую", () => {
    const site = validSite({
      "/ru/": pageHtml("/ru/", { body: '<a href="/recordings/a/">x</a>' }),
    });

    const problems = foreignLocaleLinks(site);

    expect(problems).toEqual(["/ru/: ссылка на /recordings/a/ уводит на язык «en»"]);
  });

  it("находит ссылку английской страницы на русскую", () => {
    const site = validSite({ "/": pageHtml("/", { body: '<a href="/ru/recordings/a/">x</a>' }) });

    const problems = foreignLocaleLinks(site);

    expect(problems).toEqual(["/: ссылка на /ru/recordings/a/ уводит на язык «ru»"]);
  });

  it("разрешает ссылку на другой язык с hreflang: это переключатель", () => {
    const body = '<a href="/ru/recordings/a/" hreflang="ru" lang="ru">RU</a>';
    const site = validSite({ "/recordings/a/": pageHtml("/recordings/a/", { body }) });

    const problems = foreignLocaleLinks(site);

    expect(problems).toEqual([]);
  });
});

describe("pagesMissingFromSitemap", () => {
  it("не находит ничего, если в карте сайта все страницы", () => {
    const site = validSite();

    const missing = pagesMissingFromSitemap(site);

    expect(missing).toEqual([]);
  });

  it("находит страницу, которой нет в карте сайта", () => {
    const site = validSite();
    const withoutOne = {
      ...site,
      sitemap: site.sitemap.replace(`<url><loc>${ORIGIN}/ru/</loc></url>`, ""),
    };

    const missing = pagesMissingFromSitemap(withoutOne);

    expect(missing).toEqual(["/ru/"]);
  });
});

describe("pagesMissingFromSitemap: noindex", () => {
  it("не требует в карте сайта страницу с noindex", () => {
    const site = validSite({ "/404.html": pageHtml("/404.html", { noindex: true }) });

    const missing = pagesMissingFromSitemap(site);

    expect(missing).toEqual([]);
  });
});

describe("unindexedPagesInSitemap", () => {
  it("не находит ничего, если страниц с noindex в карте сайта нет", () => {
    const site = validSite({ "/404.html": pageHtml("/404.html", { noindex: true }) });

    const listed = unindexedPagesInSitemap(site);

    expect(listed).toEqual([]);
  });

  it("находит страницу с noindex в карте сайта", () => {
    const site = validSite({ "/ru/": pageHtml("/ru/", { noindex: true }) });

    const listed = unindexedPagesInSitemap(site);

    expect(listed).toEqual(["/ru/"]);
  });
});
