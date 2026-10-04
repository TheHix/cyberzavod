import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";

export default defineConfig({
  site: "https://cyberzavod.com",
  // Все страницы собираются в статический HTML; JS получают только островки с client:*.
  output: "static",
  integrations: [solid()],
  vite: {
    resolve: {
      // Опубликованные записи лежат в корне репозитория, рядом с журналами и черновиками.
      alias: {
        "@recordings": fileURLToPath(new URL("../../recordings/published", import.meta.url)),
      },
    },
    server: {
      // В разработке запросы к API уходят в Go-сервер из docker compose.
      proxy: { "/api": "http://localhost:8080" },
    },
  },
});
