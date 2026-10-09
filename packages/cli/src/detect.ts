// What is visible in the project directory: name, languages, frameworks, package manager, git and
// scripts. The findings are a reference for `init` and a hint for check commands, not a limit:
// the stack may change, and `sync` will find it again.

import { access } from "node:fs/promises";
import path from "node:path";
import type { StackInfo } from "@cyberzavod/core";
import { CommandError } from "./errors.ts";
import { readOptionalText } from "./files.ts";

const PACKAGE_MANIFEST = "package.json";

/** What was found in the project directory. */
export interface DetectedProject {
  /** Name from the manifest, or the directory name. */
  name: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  git: boolean;
  /** `package.json` scripts and Makefile targets. */
  scripts: string[];
  /** Suggested check commands. */
  verification: string[];
}

// A language marker file: the file is found, so the language is in the project.
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

// A dependency lock file names the package manager; the first one found wins.
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

// A `package.json` dependency that identifies the framework.
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

// `package.json` scripts that check the project; `check` usually already includes the rest.
const PACKAGE_CHECK_SCRIPT = "check";
const PACKAGE_VERIFICATION_SCRIPTS = ["lint", "typecheck", "test"];
const MAKE_CHECK_TARGET = "check";
const MAKE_TARGET = /^([A-Za-z][\w-]*):(?!=)/gm;

// Check commands by language, if there are neither scripts nor a Makefile target.
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

function parseJsonManifest(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    const reason = (err as Error).message;

    throw new CommandError((m) => m.errors.packageJsonInvalid({ file: PACKAGE_MANIFEST, reason }), {
      cause: err,
    });
  }
}

function parseManifest(text: string): PackageManifest {
  const raw = parseJsonManifest(text);

  return {
    ...(typeof raw.name === "string" ? { name: raw.name } : {}),
    ...(typeof raw.packageManager === "string" ? { packageManager: raw.packageManager } : {}),
    scripts: keysOf(raw.scripts),
    dependencies: [...keysOf(raw.dependencies), ...keysOf(raw.devDependencies)],
  };
}

async function readManifest(root: string): Promise<PackageManifest | undefined> {
  const text = await readOptionalText(path.join(root, PACKAGE_MANIFEST));

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
 * Looks at what is in the project root.
 * @param {string} root Project root.
 * @returns {Promise<DetectedProject>} Name, stack, git, scripts and suggested checks.
 * @throws {CommandError} If `package.json` is not JSON.
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
 * Picks from the findings the reference stack that goes into the project config.
 * @param {DetectedProject} detected What was found in the project.
 * @returns {StackInfo} Languages, frameworks and the package manager, if found.
 */
export function stackOf(detected: DetectedProject): StackInfo {
  const { languages, frameworks, packageManager } = detected;

  if (packageManager === undefined) return { languages, frameworks };

  return { languages, frameworks, packageManager };
}

/**
 * Turns a project name into a record id: lowercase Latin letters, digits, "_" and "-".
 * @param {string} name Project name, for example `@acme/shop`.
 * @returns {string} The id, for example `acme-shop`; `project` if nothing is left of the name.
 */
export function projectIdOf(name: string): string {
  const dashed = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const id = dashed.replace(/^-+|-+$/g, "");

  return id === "" ? "project" : id;
}
