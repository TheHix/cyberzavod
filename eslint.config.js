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
import stylistic from "@stylistic/eslint-plugin";

// Тестовые файлы: для них — правила Vitest, для остального кода — обязательный JSDoc.
const TEST_FILES = ["**/*.{test,spec}.{ts,tsx}"];

// Вложенность блоков в функции — не глубже двух уровней: глубже — ранний выход или функция.
const MAX_BLOCK_DEPTH = 2;

// Пустая строка разделяет смысловые блоки: объявления — от действий, многострочный блок —
// от соседей, ранний выход — от основного пути, итог — от того, что к нему привело.
/** @type {{ blankLine: "always" | "any" | "never", prev: string | string[], next: string | string[] }[]} */
const PADDING_LINES = [
  { blankLine: "always", prev: ["const", "let"], next: "*" },
  { blankLine: "always", prev: "*", next: ["multiline-block-like", "multiline-const", "return"] },
  { blankLine: "always", prev: ["multiline-block-like", "multiline-const", "if"], next: "*" },
  { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
  { blankLine: "any", prev: "if", next: "if" },
];

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/.astro/**", "**/node_modules/**", ".cyberzavod/**", "apps/api/**"],
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
    plugins: { "@stylistic": stylistic },
    rules: {
      // После eslint-config-prettier: он выключает curly, а тело условия на отдельной строке
      // без скобок легко сломать при правке.
      curly: ["error", "multi-line"],
      // Принцип «Читаемость кода»: то, что проверяется автоматически.
      "no-nested-ternary": "error",
      "max-depth": ["error", MAX_BLOCK_DEPTH],
      "prefer-const": "error",
      "no-param-reassign": "error",
      "@stylistic/padding-line-between-statements": ["error", ...PADDING_LINES],
    },
  },
);
