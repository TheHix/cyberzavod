// @ts-check
// Правила стиля, которые можно проверить автоматически, — здесь, а не только в CLAUDE.md.

import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import solid from "eslint-plugin-solid/configs/typescript";
import jsdoc from "eslint-plugin-jsdoc";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import globals from "globals";

// Тестовые файлы: для них — правила Vitest, для остального кода — обязательный JSDoc.
const TEST_FILES = ["**/*.{test,spec}.{ts,tsx}"];

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/.astro/**", "**/node_modules/**", "journal/**", "apps/api/**"],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/src/**/*.tsx"],
    ...solid,
    languageOptions: { ...solid.languageOptions, globals: globals.browser },
  },
  // Код сайта работает в браузере: DOM-типы нужны и в .ts — например, для JSDoc.
  { files: ["apps/web/src/**/*.ts"], languageOptions: { globals: globals.browser } },
  astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [...TEST_FILES, "**/*.config.ts"],
    // Классический JSDoc с типами у @param и @returns — решение по стилю проекта.
    extends: [jsdoc.configs["flat/recommended-error"]],
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns-type": "error",
      // publicOnly: только то, что видно из других модулей, в любой форме экспорта.
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          // Пустые заготовки /** */ от --fix только прячут, что описания нет.
          enableFixer: false,
          require: {
            FunctionDeclaration: true,
            FunctionExpression: true,
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
          },
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSEnumDeclaration",
            "VariableDeclaration",
          ],
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-throws": "error",
      "jsdoc/require-description": "error",
    },
  },
  {
    files: TEST_FILES,
    extends: [vitest.configs.recommended],
    rules: {
      "vitest/require-top-level-describe": "error",
      "vitest/consistent-test-it": ["error", { fn: "it", withinDescribe: "it" }],
    },
  },
  prettier,
  {
    // После eslint-config-prettier: он выключает curly, а тело условия на отдельной строке
    // без скобок легко сломать при правке.
    rules: { curly: ["error", "multi-line"] },
  },
);
