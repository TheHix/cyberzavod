/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Тесты сайта идут через Vite-конфиг Astro: работают те же алиасы @/…, что и в сборке.
export default getViteConfig({ test: { include: ["src/**/*.{test,spec}.{ts,tsx}"] } });
