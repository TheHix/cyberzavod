import { defineConfig } from "vitest/config";

// Built-site tests run separately from source tests: they need a finished `dist/`.
export default defineConfig({ test: { include: ["build-tests/**/*.test.ts"] } });
