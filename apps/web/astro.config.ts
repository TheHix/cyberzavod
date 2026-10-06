import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";

export default defineConfig({
  site: "https://cyberzavod.com",
  // Все страницы собираются в статический HTML; JS получают только островки с client:*.
  output: "static",
  integrations: [solid()],
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
