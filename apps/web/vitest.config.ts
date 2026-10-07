/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Тесты сайта идут через Vite-конфиг Astro: работают те же алиасы @/…, что и в сборке.
// CSS в тестах по умолчанию пустой; tokens.css нужен текстом — из него собираются иконки сайта.
export default getViteConfig({
  test: { include: ["src/**/*.{test,spec}.{ts,tsx}"], css: { include: [/tokens\.css/] } },
});
