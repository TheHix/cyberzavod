import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { DEFAULT_LOCALE, LOCALES } from "./src/shared/i18n/locale.ts";

export default defineConfig({
  site: "https://cyberzavod.com",
  // Все страницы собираются в статический HTML; JS получают только островки с client:*.
  output: "static",
  integrations: [
    solid(),
    // Карта сайта со ссылками между языками (xhtml:link) строится по тем же LOCALES, что и маршруты.
    sitemap({
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((locale) => [locale, locale])),
      },
    }),
  ],
  markdown: {
    // Shiki красит код цветами своей темы инлайн-стилями, а цвета сайта берутся только из токенов.
    syntaxHighlight: false,
  },
  vite: {
    resolve: {
      // Опубликованные записи, карточки проектов и гайды лежат в корне репозитория.
      alias: {
        "@recordings": fileURLToPath(new URL("../../recordings/published", import.meta.url)),
        "@projects": fileURLToPath(new URL("../../projects", import.meta.url)),
        "@guides": fileURLToPath(new URL("../../guides", import.meta.url)),
      },
    },
    server: {
      // В разработке запросы к API уходят в Go-сервер из docker compose.
      proxy: { "/api": "http://localhost:8080" },
    },
  },
});
