// `cyberzavod init`: подключает проект в текущем каталоге — мастер, конфиг, AGENTS.md
// и файлы агента. Проект остаётся на своём месте: Cyberzavod его не клонирует и не переносит.

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncClaude } from "@cyberzavod/adapter-claude";
import {
  isNotFound,
  loadHarness,
  PROJECT_CONFIG_FILE,
  readProjectConfig,
  writeProjectConfig,
} from "@cyberzavod/storage";
import { detectProject } from "../detect.ts";
import { CommandError } from "../errors.ts";
import { HARNESS_DIRECTORY, HARNESS_VERSION, TEMPLATES_DIRECTORY } from "../install.ts";
import { askProjectConfig, describeDetected, type Prompter } from "../wizard.ts";

const RULES_FILE = "AGENTS.md";
// Заготовка лежит не под именем AGENTS.md: иначе sync принял бы каталог шаблонов за часть проекта.
const RULES_TEMPLATE = "rules.md";
const LEGACY_ENTRYPOINT = "CLAUDE.md";

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

function starterRules(template: string, name: string, commands: string[]): string {
  const verification =
    commands.length === 0
      ? "  - пока не заданы"
      : commands.map((command) => `  - \`${command}\``).join("\n");
  return template.replace("{{name}}", name).replace("{{verification}}", verification);
}

// Правила проекта живут в AGENTS.md. Написанный человеком CLAUDE.md и есть эти правила:
// он переезжает в AGENTS.md, а на его месте появится тонкий CLAUDE.md от генератора.
async function ensureRules(root: string, name: string, commands: string[]): Promise<string> {
  const rules = path.join(root, RULES_FILE);
  if ((await readOptional(rules)) !== undefined) return `${RULES_FILE} уже есть — оставлен`;
  const legacy = path.join(root, LEGACY_ENTRYPOINT);
  if ((await readOptional(legacy)) !== undefined) {
    await rename(legacy, rules);
    return `${LEGACY_ENTRYPOINT} перенесён в ${RULES_FILE}: правила проекта теперь там`;
  }
  const template = await readFile(path.join(TEMPLATES_DIRECTORY, RULES_TEMPLATE), "utf8");
  await writeFile(rules, starterRules(template, name, commands));
  return `${RULES_FILE} — заготовка правил проекта, заполните её`;
}

/**
 * Подключает проект: показывает найденное, спрашивает настройки, пишет конфиг и файлы агента.
 * @param {string} root Корень проекта — каталог, из которого запущена команда.
 * @param {Prompter} prompter Кто отвечает на вопросы мастера.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {CommandError} Если проект уже подключён.
 */
export async function initProject(root: string, prompter: Prompter): Promise<void> {
  if ((await readProjectConfig(root)) !== undefined) {
    throw new CommandError(`${PROJECT_CONFIG_FILE} уже есть: проект подключён, используйте sync`);
  }
  const detected = await detectProject(root);
  const harness = await loadHarness(HARNESS_DIRECTORY);
  for (const line of describeDetected(root, detected)) console.log(line);
  const answers = await askProjectConfig(root, detected, harness, prompter);
  const { projectId, ...rest } = answers;
  const config = { projectId, harness: HARNESS_VERSION, ...rest };

  await writeProjectConfig(root, config);
  const rules = await ensureRules(root, detected.name, config.verification.commands);
  const report = await syncClaude({ projectDirectory: root });

  console.log(`\nСоздано:\n  ${PROJECT_CONFIG_FILE}\n  ${rules}`);
  for (const file of report.changed) console.log(`  ${file}`);
  console.log(
    `\nЖурнал проекта: ${config.journal}\n` +
      "Дальше: допишите правила в AGENTS.md и запускайте задачи через /feature в Claude Code.",
  );
}
