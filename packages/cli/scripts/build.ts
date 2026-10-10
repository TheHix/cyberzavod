// Builds the npm package: the CLI with all monorepo packages, the harness and templates, into one
// file without dependencies. npm publishes the file, and npx runs it.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build, type Plugin } from "esbuild";
import { readHarnessFiles } from "@cyberzavod/storage";

const PACKAGE = path.resolve(import.meta.dirname, "..");
const REPOSITORY = path.resolve(PACKAGE, "../..");
const ENTRY = path.join(PACKAGE, "src/bin/cyberzavod.ts");
const OUTPUT = path.join(PACKAGE, "dist/cyberzavod.mjs");
const LICENSES_OUTPUT = path.join(PACKAGE, "dist/THIRD_PARTY_LICENSES");
// Packages whose code the bundle contains; the bundle drops their license comments, so the notices
// go beside it.
const BUNDLED_PACKAGES = [path.join(REPOSITORY, "adapters/codex/node_modules/smol-toml")];
const ASSETS_MODULE = path.join(PACKAGE, "src/installation/assets.ts");
const HARNESS_DIRECTORY = path.join(REPOSITORY, "harness");
// Keys must match src/installation/assets.ts: templates are keyed `<source>/<name>`.
const TEMPLATE_DIRECTORIES: Readonly<Record<string, string>> = {
  cli: path.join(PACKAGE, "templates"),
  kit: path.join(REPOSITORY, "packages/adapter-kit/templates"),
  claude: path.join(REPOSITORY, "adapters/claude/templates"),
  codex: path.join(REPOSITORY, "adapters/codex/templates"),
};
const ASSETS_NAMESPACE = "cyberzavod-assets";
// The oldest Node that still gets security updates.
const NODE_TARGET = "node22";

// Keys in order: the built file must not depend on directory read order, otherwise
// `sync --check` sees a difference where there is none.
function sortedByName(texts: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(texts).sort(([a], [b]) => a.localeCompare(b)));
}

async function readTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};

  for (const [source, directory] of Object.entries(TEMPLATE_DIRECTORIES)) {
    for (const name of await readdir(directory)) {
      templates[`${source}/${name}`] = await readFile(path.join(directory, name), "utf8");
    }
  }

  return templates;
}

async function embeddedAssetsModule(): Promise<string> {
  const harnessFiles = await readHarnessFiles(HARNESS_DIRECTORY);
  const templateFiles = await readTemplates();
  const harness = sortedByName(harnessFiles);
  const templates = sortedByName(templateFiles);

  return `const harness = ${JSON.stringify(harness)};
const templates = ${JSON.stringify(templates)};

export async function readAssets() {
  return { harness, templates };
}
`;
}

const embeddedAssets: Plugin = {
  name: ASSETS_NAMESPACE,
  setup(builder) {
    builder.onResolve({ filter: /\/assets\.ts$/ }, (args) => {
      // A plugin namespace path is constant, unlike a disk path: it ends up in a comment of the
      // built file, and the file must match byte for byte on any machine.
      const resolved = path.resolve(args.resolveDir, args.path);

      return resolved === ASSETS_MODULE ? { path: "assets", namespace: ASSETS_NAMESPACE } : null;
    });
    builder.onLoad({ filter: /.*/, namespace: ASSETS_NAMESPACE }, async () => ({
      contents: await embeddedAssetsModule(),
      loader: "js",
      resolveDir: path.dirname(ASSETS_MODULE),
    }));
  },
};

await build({
  entryPoints: [ENTRY],
  outfile: OUTPUT,
  bundle: true,
  platform: "node",
  format: "esm",
  target: NODE_TARGET,
  legalComments: "none",
  plugins: [embeddedAssets],
  logLevel: "warning",
});

async function noticeOf(packageDirectory: string): Promise<string> {
  const manifest = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  ) as {
    name: string;
    version: string;
    license: string;
  };
  const license = await readFile(path.join(packageDirectory, "LICENSE"), "utf8");

  return `${manifest.name} ${manifest.version} (${manifest.license})\n\n${license.trim()}\n`;
}

const notices = await Promise.all(BUNDLED_PACKAGES.map(noticeOf));

await writeFile(LICENSES_OUTPUT, notices.join("\n"));
