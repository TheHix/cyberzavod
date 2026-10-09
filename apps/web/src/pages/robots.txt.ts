import type { APIRoute } from "astro";

// @astrojs/sitemap builds the sitemap: the index is at the root and refers to the parts.
const SITEMAP_INDEX = "sitemap-index.xml";

/**
 * Rules for search robots: the whole site is open, the sitemap is at the root.
 * @param {object} context Astro route context.
 * @param {URL | undefined} context.site Site address from `astro.config.ts`.
 * @returns {Response} robots.txt text.
 * @throws {Error} If `site` is not set in `astro.config.ts`.
 */
export const GET: APIRoute = ({ site }) => {
  if (site === undefined) throw new Error("для robots.txt в astro.config.ts нужен site");

  const sitemap = new URL(SITEMAP_INDEX, site).href;

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
