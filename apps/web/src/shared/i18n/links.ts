import type { Locale } from "./locale.ts";
import { localizedPath, pathWithoutLocale } from "./path.ts";

// The attribute is matched only inside an opening `<a …>` tag: in code block text `<` is escaped
// as `&lt;` but the quote is not, so ` href="` in a code sample does not count as a tag.
const ANCHOR_HREF = /(<a\b[^>]*?\shref=")([^"]*)(")/g;
const QUERY_OR_FRAGMENT = /[?#]/;
// Files (`/favicon.svg`, `/files/a.pdf`) are not localized: one version serves all languages.
const FILE_EXTENSION = /\.[^/.]+$/;

/**
 * Switches a link to a page of this same site to the page language: content written once
 * (guides, project cards) does not know which language it will be shown in. External addresses,
 * anchors and links that already name a language stay as they are.
 * @param {string} href Address from the content: `/projects/x/`, `https://cyberzavod.com/` or
 * an external one.
 * @param {Locale} locale Language of the page the link is on.
 * @param {string} origin Site address: `https://cyberzavod.com`.
 * @returns {string} Address in the page language.
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
 * Switches all links to this same site in ready-made markup to the page language.
 * @param {string} html Content markup, for example a guide.
 * @param {Locale} locale Language of the page the content is on.
 * @param {string} origin Site address: `https://cyberzavod.com`.
 * @returns {string} Markup with links in the page language.
 */
export function localizeLinks(html: string, locale: Locale, origin: string): string {
  return html.replace(
    ANCHOR_HREF,
    (_attribute, before: string, href: string, after: string) =>
      `${before}${localizeHref(href, locale, origin)}${after}`,
  );
}
