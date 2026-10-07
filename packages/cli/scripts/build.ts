// Сборка npm-пакета: CLI со всеми пакетами монорепозитория, harness и шаблонами — в один файл
// без зависимостей. Этот же файл init и sync кладут в проект, и хуки запускают его оттуда.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { build, type Plugin } from "esbuild";
import { readHarnessFiles } from "@cyberzavod/storage";

const PACKAGE = path.resolve(import.meta.dirname, "..");
const REPOSITORY = path.resolve(PACKAGE, "../..");
const ENTRY = path.join(PACKAGE, "src/bin/cyberzavod.ts");
const OUTPUT = path.join(PACKAGE, "dist/cyberzavod.mjs");
const ASSETS_MODULE = path.join(PACKAGE, "src/installation/assets.ts");
const HARNESS_DIRECTORY = path.join(REPOSITORY, "harness");
const TEMPLATE_DIRECTORIES = [
  path.join(PACKAGE, "templates"),
  path.join(REPOSITORY, "adapters/claude/templates"),
];
const ASSETS_NAMESPACE = "cyberzavod-assets";
// Самая старая Node, которой ещё выходят обновления безопасности.
const NODE_TARGET = "node22";

// Ключи по порядку: собранный файл не должен зависеть от порядка чтения каталога, иначе
// `sync --check` увидит расхождение там, где его нет.
function sortedByName(texts: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(texts).sort(([a], [b]) => a.localeCompare(b)));
}

async function readTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};
  for (const directory of TEMPLATE_DIRECTORIES) {
    for (const name of await readdir(directory)) {
      templates[name] = await readFile(path.join(directory, name), "utf8");
    }
  }
  return templates;
}

// Собранный CLI знает себя сам: читает свой файл, чтобы положить его в проект.
async function embeddedAssetsModule(): Promise<string> {
  const harness = sortedByName(await readHarnessFiles(HARNESS_DIRECTORY));
  const templates = sortedByName(await readTemplates());
  return `import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const harness = ${JSON.stringify(harness)};
const templates = ${JSON.stringify(templates)};

export async function readAssets() {
  return { harness, templates, tool: readFileSync(fileURLToPath(import.meta.url), "utf8") };
}
`;
}

const embeddedAssets: Plugin = {
  name: ASSETS_NAMESPACE,
  setup(builder) {
    builder.onResolve({ filter: /\/assets\.ts$/ }, (args) => {
      // Путь в пространстве плагина — постоянный, а не путь на диске: он попадает в комментарий
      // собранного файла, а файл должен совпадать байт в байт на любой машине.
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
