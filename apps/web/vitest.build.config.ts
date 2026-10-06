import { defineConfig } from "vitest/config";

// Тесты собранного сайта идут отдельно от тестов исходников: им нужен готовый `dist/`.
export default defineConfig({ test: { include: ["build-tests/**/*.test.ts"] } });
