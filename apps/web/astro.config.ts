import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { isUnindexedPath } from "./src/shared/config/routes.ts";
import { DEFAULT_LOCALE, LOCALES } from "./src/shared/i18n/locale.ts";
import { pathWithoutLocale } from "./src/shared/i18n/path.ts";

export default defineConfig({
  site: "https://cyberzavod.com",
  // All pages build to static HTML; only client:* islands get JS.
  output: "static",
  integrations: [
    solid(),
    // The sitemap with links between languages (xhtml:link) uses the same LOCALES as the routes.
    sitemap({
      // Pages with noindex are not offered to search engines.
      filter: (page) => !isUnindexedPath(pathWithoutLocale(new URL(page).pathname)),
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((locale) => [locale, locale])),
      },
    }),
  ],
  markdown: {
    // Shiki colors code with its theme as inline styles, but site colors come only from tokens.
    syntaxHighlight: false,
  },
  vite: {
    resolve: {
      // The project journal, project cards and guides live at the repository root.
      alias: {
        "@journal": fileURLToPath(new URL("../../.cyberzavod/journal", import.meta.url)),
        "@projects": fileURLToPath(new URL("../../projects", import.meta.url)),
        "@guides": fileURLToPath(new URL("../../guides", import.meta.url)),
      },
    },
    server: {
      // In development, API requests go to the Go server from docker compose.
      proxy: { "/api": "http://localhost:8080" },
    },
  },
});
