import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../astro.config.ts";
import {
  brokenLinks,
  foreignLocaleLinks,
  missingAlternates,
  pagesMissingFromSitemap,
  readBuiltSite,
  type BuiltSite,
} from "./built-site.ts";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

// Тесты идут после `astro build`: без сборки проверять нечего, и это ошибка, а не пропуск.
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
