// Installation texts read from the sources: harness and templates. The CLI build replaces this
// module with embedded texts (see scripts/build.ts), so the built file does not need the
// Cyberzavod repository.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readHarnessFiles } from "@cyberzavod/storage";
import type { Assets } from "./types.ts";

const REPOSITORY = path.resolve(import.meta.dirname, "../../../..");
const HARNESS_DIRECTORY = path.join(REPOSITORY, "harness");
const TEMPLATE_DIRECTORIES = [
  path.join(REPOSITORY, "packages/cli/templates"),
  path.join(REPOSITORY, "adapters/claude/templates"),
];

async function readTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};

  for (const directory of TEMPLATE_DIRECTORIES) {
    for (const name of await readdir(directory)) {
      templates[name] = await readFile(path.join(directory, name), "utf8");
    }
  }

  return templates;
}

/**
 * Reads installation texts from the sources.
 * @returns {Promise<Assets>} Harness and templates.
 */
export async function readAssets(): Promise<Assets> {
  return {
    harness: await readHarnessFiles(HARNESS_DIRECTORY),
    templates: await readTemplates(),
  };
}
