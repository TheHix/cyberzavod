import type { APIRoute } from "astro";

// Карту сайта собирает @astrojs/sitemap: индекс лежит в корне и ссылается на части.
const SITEMAP_INDEX = "sitemap-index.xml";

/**
 * Правила для поисковых роботов: сайт открыт целиком, карта сайта — в корне.
 * @param {object} context Контекст маршрута Astro.
 * @param {URL | undefined} context.site Адрес сайта из `astro.config.ts`.
 * @returns {Response} Текст robots.txt.
 * @throws {Error} Если в `astro.config.ts` не задан `site`.
 */
export const GET: APIRoute = ({ site }) => {
  if (site === undefined) throw new Error("для robots.txt в astro.config.ts нужен site");
  const sitemap = new URL(SITEMAP_INDEX, site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
