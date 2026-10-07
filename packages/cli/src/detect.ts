// Что видно в каталоге проекта: имя, языки, фреймворки, менеджер пакетов, git и скрипты.
// Найденное — справка для мастера `init` и подсказка команд проверки, а не ограничение:
// стек может смениться, и `sync` найдёт его заново.

import { access } from "node:fs/promises";
import path from "node:path";
import type { StackInfo } from "@cyberzavod/core";
import { readOptionalText } from "./files.ts";

/** Найденное в каталоге проекта. */
export interface DetectedProject {
  /** Имя из манифеста или имя каталога. */
  name: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  git: boolean;
  /** Скрипты `package.json` и цели Makefile. */
  scripts: string[];
  /** Предлагаемые команды проверки. */
  verification: string[];
}

// Файл-признак языка: найден файл — язык есть в проекте.
const LANGUAGE_MARKERS: readonly { file: string; language: string }[] = [
  { file: "package.json", language: "javascript" },
  { file: "tsconfig.json", language: "typescript" },
  { file: "go.mod", language: "go" },
  { file: "pyproject.toml", language: "python" },
  { file: "requirements.txt", language: "python" },
  { file: "Cargo.toml", language: "rust" },
  { file: "pom.xml", language: "java" },
  { file: "build.gradle", language: "java" },
  { file: "build.gradle.kts", language: "kotlin" },
  { file: "Gemfile", language: "ruby" },
  { file: "composer.json", language: "php" },
];

// Файл блокировки зависимостей называет менеджер пакетов; первый найденный выигрывает.
const LOCKFILES: readonly { file: string; packageManager: string }[] = [
  { file: "pnpm-lock.yaml", packageManager: "pnpm" },
  { file: "yarn.lock", packageManager: "yarn" },
  { file: "bun.lock", packageManager: "bun" },
  { file: "bun.lockb", packageManager: "bun" },
  { file: "package-lock.json", packageManager: "npm" },
  { file: "uv.lock", packageManager: "uv" },
  { file: "poetry.lock", packageManager: "poetry" },
  { file: "Cargo.lock", packageManager: "cargo" },
  { file: "go.sum", packageManager: "go" },
];

// Зависимость `package.json`, по которой узнаётся фреймворк.
const FRAMEWORK_DEPENDENCIES: Readonly<Record<string, string>> = {
  react: "react",
  vue: "vue",
  svelte: "svelte",
  "solid-js": "solid",
  astro: "astro",
  next: "next",
  nuxt: "nuxt",
  "@angular/core": "angular",
  express: "express",
  "@nestjs/core": "nest",
};

// Скрипты `package.json`, которые проверяют проект; `check` обычно уже включает остальные.
const PACKAGE_CHECK_SCRIPT = "check";
const PACKAGE_VERIFICATION_SCRIPTS = ["lint", "typecheck", "test"];
const MAKE_CHECK_TARGET = "check";
const MAKE_TARGET = /^([A-Za-z][\w-]*):(?!=)/gm;

// Команды проверки по языку, если ни скриптов, ни цели Makefile нет.
const LANGUAGE_VERIFICATION: Readonly<Record<string, string[]>> = {
  go: ["go vet ./...", "go test ./..."],
  rust: ["cargo test"],
  python: ["pytest"],
};

interface PackageManifest {
  name?: string;
  packageManager?: string;
  scripts: string[];
  dependencies: string[];
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

function keysOf(value: unknown): string[] {
  return typeof value === "object" && value !== null ? Object.keys(value) : [];
}

function parseManifest(text: string): PackageManifest {
  const raw = JSON.parse(text) as Record<string, unknown>;

  return {
    ...(typeof raw.name === "string" ? { name: raw.name } : {}),
    ...(typeof raw.packageManager === "string" ? { packageManager: raw.packageManager } : {}),
    scripts: keysOf(raw.scripts),
    dependencies: [...keysOf(raw.dependencies), ...keysOf(raw.devDependencies)],
  };
}

async function readManifest(root: string): Promise<PackageManifest | undefined> {
  const text = await readOptionalText(path.join(root, "package.json"));

  return text === undefined ? undefined : parseManifest(text);
}

async function makeTargets(root: string): Promise<string[]> {
  const makefile = await readOptionalText(path.join(root, "Makefile"));

  if (makefile === undefined) return [];

  return [...makefile.matchAll(MAKE_TARGET)].map((match) => match[1] ?? "");
}

async function languageOf(
  root: string,
  marker: (typeof LANGUAGE_MARKERS)[number],
): Promise<string | undefined> {
  const isMarked = await exists(path.join(root, marker.file));

  return isMarked ? marker.language : undefined;
}

async function languagesOf(root: string): Promise<string[]> {
  const found = await Promise.all(LANGUAGE_MARKERS.map((marker) => languageOf(root, marker)));
  const languages = found.filter((language) => language !== undefined);

  return [...new Set(languages)];
}

async function packageManagerOf(
  root: string,
  manifest: PackageManifest | undefined,
): Promise<string | undefined> {
  const declared = manifest?.packageManager?.split("@")[0];

  if (declared !== undefined && declared !== "") return declared;

  for (const { file, packageManager } of LOCKFILES) {
    if (await exists(path.join(root, file))) return packageManager;
  }

  return manifest === undefined ? undefined : "npm";
}

function verificationOf({
  manifest,
  packageManager,
  targets,
  languages,
}: {
  manifest: PackageManifest | undefined;
  packageManager: string | undefined;
  targets: string[];
  languages: string[];
}): string[] {
  if (targets.includes(MAKE_CHECK_TARGET)) return [`make ${MAKE_CHECK_TARGET}`];

  const runner = packageManager ?? "npm";
  const scripts = manifest?.scripts ?? [];
  const packageScripts = scripts.includes(PACKAGE_CHECK_SCRIPT)
    ? [PACKAGE_CHECK_SCRIPT]
    : PACKAGE_VERIFICATION_SCRIPTS.filter((script) => scripts.includes(script));
  const languageCommands = languages.flatMap((language) => LANGUAGE_VERIFICATION[language] ?? []);
  const packageCommands = packageScripts.map((script) => `${runner} run ${script}`);

  return [...packageCommands, ...languageCommands];
}

/**
 * Смотрит, что лежит в корне проекта.
 * @param {string} root Корень проекта.
 * @returns {Promise<DetectedProject>} Имя, стек, git, скрипты и предлагаемые проверки.
 * @throws {SyntaxError} Если `package.json` не JSON.
 */
export async function detectProject(root: string): Promise<DetectedProject> {
  const manifest = await readManifest(root);
  const languages = await languagesOf(root);
  const packageManager = await packageManagerOf(root, manifest);
  const targets = await makeTargets(root);
  const dependencies = manifest?.dependencies ?? [];
  const frameworks = Object.entries(FRAMEWORK_DEPENDENCIES)
    .filter(([dependency]) => dependencies.includes(dependency))
    .map(([, framework]) => framework);
  const hasGit = await exists(path.join(root, ".git"));
  const makeScripts = targets.map((target) => `make ${target}`);

  return {
    name: manifest?.name ?? path.basename(root),
    languages,
    frameworks,
    ...(packageManager === undefined ? {} : { packageManager }),
    git: hasGit,
    scripts: [...(manifest?.scripts ?? []), ...makeScripts],
    verification: verificationOf({ manifest, packageManager, targets, languages }),
  };
}

/**
 * Выбирает из найденного справочный стек, который кладётся в конфиг проекта.
 * @param {DetectedProject} detected Найденное в проекте.
 * @returns {StackInfo} Языки, фреймворки и менеджер пакетов, если он найден.
 */
export function stackOf(detected: DetectedProject): StackInfo {
  const { languages, frameworks, packageManager } = detected;

  if (packageManager === undefined) return { languages, frameworks };

  return { languages, frameworks, packageManager };
}

/**
 * Превращает имя проекта в идентификатор записи: строчные латинские буквы, цифры, «_» и «-».
 * @param {string} name Имя проекта, например `@acme/shop`.
 * @returns {string} Идентификатор, например `acme-shop`; `project`, если от имени ничего не осталось.
 */
export function projectIdOf(name: string): string {
  const dashed = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const id = dashed.replace(/^-+|-+$/g, "");

  return id === "" ? "project" : id;
}
