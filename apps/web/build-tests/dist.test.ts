import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../astro.config.ts";
import {
  brokenLinks,
  foreignLocaleLinks,
  isIndexed,
  localeOfPage,
  missingAlternates,
  pageUrlOf,
  pagesMissingFromSitemap,
  readBuiltSite,
  unindexedPagesInSitemap,
  type BuiltSite,
} from "./built-site.ts";
import { notFoundFilesOf } from "./nginx.ts";
import { LOCALES } from "../src/shared/i18n/locale.ts";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const NGINX_CONFIG = fileURLToPath(new URL("../nginx.conf", import.meta.url));

// The tests run after `astro build`: without a build there is nothing to check, and that is an
// error, not a skip.
function builtSite(): BuiltSite {
  if (!existsSync(DIST)) throw new Error("нет dist/: сначала нужна сборка `astro build`");
  if (config.site === undefined) throw new Error("в astro.config.ts не задан site");

  return readBuiltSite(DIST, config.site);
}

describe("readBuiltSite", () => {
  it("читает из dist/ страницы", () => {
    const site = builtSite();

    expect(site.pages.size).toBeGreaterThan(0);
  });
});

describe("brokenLinks", () => {
  it("не находит в dist/ сломанных внутренних ссылок", () => {
    const site = builtSite();

    const problems = brokenLinks(site);

    expect(problems).toEqual([]);
  });
});

describe("missingAlternates", () => {
  it("не находит в dist/ страниц без языка, canonical на себя и hreflang на существующие страницы", () => {
    const site = builtSite();

    const problems = missingAlternates(site);

    expect(problems).toEqual([]);
  });
});

describe("foreignLocaleLinks", () => {
  it("не находит в dist/ ссылок без hreflang на другой язык", () => {
    const site = builtSite();

    const problems = foreignLocaleLinks(site);

    expect(problems).toEqual([]);
  });
});

describe("pagesMissingFromSitemap", () => {
  it("не находит в dist/ страниц вне карты сайта", () => {
    const site = builtSite();

    const missing = pagesMissingFromSitemap(site);

    expect(missing).toEqual([]);
  });
});

describe("unindexedPagesInSitemap", () => {
  it("не находит в карте сайта страниц с noindex", () => {
    const site = builtSite();

    const listed = unindexedPagesInSitemap(site);

    expect(listed).toEqual([]);
  });
});

describe("notFoundFilesOf", () => {
  it("находит в dist/ страницу «не найдено» с noindex на каждом языке для nginx", () => {
    const site = builtSite();
    const files = notFoundFilesOf(readFileSync(NGINX_CONFIG, "utf8"));

    const pages = files.map((file) => {
      const pageUrl = pageUrlOf(file) ?? file;
      const html = site.pages.get(pageUrl);

      return {
        file,
        locale: localeOfPage(pageUrl),
        indexed: html === undefined ? "нет страницы" : isIndexed(html),
      };
    });

    const locales = pages.map(({ locale }) => locale).sort();
    const indexedPages = pages.filter(({ indexed }) => indexed !== false);

    expect(locales).toEqual([...LOCALES].sort());
    expect(indexedPages).toEqual([]);
  });
});
