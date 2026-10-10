// Installation texts read from the sources: harness and templates. The CLI build replaces this
// module with embedded texts (see scripts/build.ts), so the built file does not need the
// Cyberzavod repository.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readHarnessFiles } from "@cyberzavod/storage";
import type { Assets } from "./types.ts";

const REPOSITORY = path.resolve(import.meta.dirname, "../../../..");
const HARNESS_DIRECTORY = path.join(REPOSITORY, "harness");
// Templates are keyed `<source>/<name>`: two adapters may have a template of the same name.
const TEMPLATE_DIRECTORIES: Readonly<Record<string, string>> = {
  cli: path.join(REPOSITORY, "packages/cli/templates"),
  kit: path.join(REPOSITORY, "packages/adapter-kit/templates"),
  claude: path.join(REPOSITORY, "adapters/claude/templates"),
  codex: path.join(REPOSITORY, "adapters/codex/templates"),
};

async function readTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};

  for (const [source, directory] of Object.entries(TEMPLATE_DIRECTORIES)) {
    for (const name of await readdir(directory)) {
      templates[`${source}/${name}`] = await readFile(path.join(directory, name), "utf8");
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
