import { describe, expect, it } from "vitest";
import { localizeHref, localizeLinks } from "./links.ts";

const ORIGIN = "https://example.test";

describe("localizeHref", () => {
  it.each([
    ["/projects/x/", "en", "/projects/x/"],
    ["/projects/x/", "ru", "/ru/projects/x/"],
    ["/", "ru", "/ru/"],
    [`${ORIGIN}/projects/x/`, "ru", `${ORIGIN}/ru/projects/x/`],
    [`${ORIGIN}/`, "ru", `${ORIGIN}/ru/`],
    [ORIGIN, "ru", `${ORIGIN}/ru/`],
    [ORIGIN, "en", ORIGIN],
    [`${ORIGIN}/projects/x/`, "en", `${ORIGIN}/projects/x/`],
    ["/projects/x/?a=1#b", "ru", "/ru/projects/x/?a=1#b"],
    ["/#section", "ru", "/ru/#section"],
    ["/projects/x/?a=1#b", "en", "/projects/x/?a=1#b"],
  ] as const)("ссылку %s на странице языка %s превращает в %s", (href, locale, expected) => {
    const result = localizeHref(href, locale, ORIGIN);

    expect(result).toBe(expected);
  });

  it.each([
    "https://other.test/projects/x/",
    "https://github.com/bysavelii/cyberzavod",
    "//other.test/x/",
    "#section",
    "mailto:a@b.test",
    "relative/page/",
    "/ru/projects/x/",
    "/ru",
    "/ru?a=1",
    "/ru/#section",
    "https://cyberzavod.com.evil.test/x/",
    "tel:+10000000000",
    "/favicon.svg",
    "/files/report.pdf?v=2",
  ])("оставляет %s как есть", (href) => {
    const result = localizeHref(href, "ru", ORIGIN);

    expect(result).toBe(href);
  });
});

describe("localizeLinks", () => {
  it("переводит только ссылки на свой сайт", () => {
    const html = '<p><a href="/projects/x/">x</a> и <a href="https://other.test/">y</a></p>';

    const result = localizeLinks(html, "ru", ORIGIN);

    expect(result).toBe(
      '<p><a href="/ru/projects/x/">x</a> и <a href="https://other.test/">y</a></p>',
    );
  });

  it("не трогает href в тексте блока кода", () => {
    const html = '<pre><code>&lt;a href="/projects/x/"&gt;</code></pre>';

    const result = localizeLinks(html, "ru", ORIGIN);

    expect(result).toBe(html);
  });

  it("переводит ссылку с другими атрибутами в теге", () => {
    const html = '<a class="x" href="/projects/x/" id="y">x</a>';

    const result = localizeLinks(html, "ru", ORIGIN);

    expect(result).toBe('<a class="x" href="/ru/projects/x/" id="y">x</a>');
  });

  it("не трогает текст и разметку без ссылок", () => {
    const html = "<p>Текст про /projects/x/ без ссылки</p>";

    const result = localizeLinks(html, "ru", ORIGIN);

    expect(result).toBe(html);
  });
});
