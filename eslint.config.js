// @ts-check
// Style rules that can be checked automatically live here, not only in CLAUDE.md.

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

// Test files get the Vitest rules; the rest of the code gets mandatory JSDoc.
const TEST_FILES = ["**/*.{test,spec}.{ts,tsx}"];

// Block nesting in a function is at most two levels: deeper means an early exit or a function.
const MAX_BLOCK_DEPTH = 2;

// A blank line separates blocks of meaning: declarations from actions, a multiline block
// from its neighbours, an early exit from the main path, the result from what led to it.
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
  // Site code runs in the browser: DOM types are needed in .ts too, for example for JSDoc.
  { files: ["apps/web/src/**/*.ts"], languageOptions: { globals: globals.browser } },
  astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [...TEST_FILES, "**/*.config.ts"],
    // Classic JSDoc with types on @param and @returns is a project style decision.
    extends: [jsdoc.configs["flat/recommended-error"]],
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns-type": "error",
      // publicOnly: only what is visible from other modules, in any form of export.
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          // Empty /** */ stubs from --fix only hide that there is no description.
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
      // After eslint-config-prettier: it turns off curly, and a condition body on a separate line
      // without braces is easy to break when editing.
      curly: ["error", "multi-line"],
      // The "Code readability" principle: what is checked automatically.
      "no-nested-ternary": "error",
      "max-depth": ["error", MAX_BLOCK_DEPTH],
      "prefer-const": "error",
      "no-param-reassign": "error",
      "@stylistic/padding-line-between-statements": ["error", ...PADDING_LINES],
    },
  },
);
