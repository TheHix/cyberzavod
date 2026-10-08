// `cyberzavod init`: подключает проект в текущем каталоге — мастер, конфиг, AGENTS.md
// и файлы агента. Проект остаётся на своём месте: Cyberzavod его не клонирует и не переносит.

import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncClaude } from "@cyberzavod/adapter-claude";
import {
  PROJECT_CONFIG_FILE,
  readProjectConfig,
  TOOL_FILE,
  writeProjectConfig,
} from "@cyberzavod/storage";
import { detectProject } from "../detect.ts";
import { CommandError } from "../errors.ts";
import { readOptionalText } from "../files.ts";
import { HARNESS_VERSION, toolOf, type Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { askProjectConfig, describeDetected, type Prompter } from "../wizard.ts";
import { ignoreCapture } from "./gitignore.ts";
import { updateToolFile } from "./tool-file.ts";

const RULES_FILE = "AGENTS.md";
const LEGACY_ENTRYPOINT = "CLAUDE.md";

function starterRules(template: string, name: string, commands: string[]): string {
  const verification =
    commands.length === 0
      ? "  - пока не заданы"
      : commands.map((command) => `  - \`${command}\``).join("\n");

  return template.replace("{{name}}", name).replace("{{verification}}", verification);
}

interface RulesSource {
  root: string;
  template: string;
  name: string;
  commands: string[];
  messages: CliMessages;
}

// Правила проекта живут в AGENTS.md. Написанный человеком CLAUDE.md и есть эти правила:
// он переезжает в AGENTS.md, а на его месте появится тонкий CLAUDE.md от генератора.
async function ensureRules(source: RulesSource): Promise<string> {
  const { root, template, name, commands, messages } = source;

  const rules = path.join(root, RULES_FILE);
  const hasRules = (await readOptionalText(rules)) !== undefined;

  if (hasRules) return messages.init.rulesKept(RULES_FILE);

  const legacy = path.join(root, LEGACY_ENTRYPOINT);
  const hasLegacyEntrypoint = (await readOptionalText(legacy)) !== undefined;

  if (hasLegacyEntrypoint) {
    await rename(legacy, rules);

    return messages.init.rulesMoved({ from: LEGACY_ENTRYPOINT, to: RULES_FILE });
  }

  await writeFile(rules, starterRules(template, name, commands));

  return messages.init.rulesStarter(RULES_FILE);
}

interface CreatedReport {
  rules: string;
  files: string[];
  ignored: string | undefined;
  messages: CliMessages;
}

function printCreated({ rules, files, ignored, messages }: CreatedReport): void {
  console.log(`\n${messages.init.created}\n  ${PROJECT_CONFIG_FILE}\n  ${TOOL_FILE}\n  ${rules}`);

  for (const file of files) console.log(`  ${file}`);

  if (ignored !== undefined) console.log(`  ${messages.init.ignoredEntry(ignored)}`);
}

function printNextSteps(journal: string, messages: CliMessages): void {
  console.log(`\n${messages.init.journal(journal)}\n${messages.init.nextSteps}`);
}

/** Что нужно подключению проекта: кто отвечает на вопросы, версия Cyberzavod и тексты. */
export interface InitOptions {
  /** Кто отвечает на вопросы мастера. */
  prompter: Prompter;
  /** Запущенная версия Cyberzavod. */
  installation: Installation;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/**
 * Подключает проект: показывает найденное, спрашивает настройки, пишет конфиг и файлы агента.
 * @param {string} root Корень проекта — каталог, из которого запущена команда.
 * @param {InitOptions} options Кто отвечает на вопросы мастера, версия Cyberzavod, сообщения.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {CommandError} Если проект уже подключён или CLI запущен из исходников.
 */
export async function initProject(root: string, options: InitOptions): Promise<void> {
  const { prompter, installation, messages } = options;
  const isConnected = (await readProjectConfig(root)) !== undefined;

  if (isConnected) {
    throw new CommandError((m) => m.errors.alreadyConnected(PROJECT_CONFIG_FILE));
  }

  const tool = toolOf(installation);
  const detected = await detectProject(root);

  for (const line of describeDetected(root, detected, messages)) console.log(line);

  const answers = await askProjectConfig({
    detected,
    harness: installation.harness,
    prompter,
    messages,
  });
  const { projectId, ...rest } = answers;
  const config = { projectId, harness: HARNESS_VERSION, ...rest };

  await writeProjectConfig(root, config);

  const rules = await ensureRules({
    root,
    template: installation.rulesTemplate,
    name: detected.name,
    commands: config.verification.commands,
    messages,
  });

  await updateToolFile(root, tool);

  const ignored = await ignoreCapture(root, config.journal);
  const report = await syncClaude({
    projectDirectory: root,
    installation: { harness: installation.harness, templates: installation.claudeTemplates },
  });

  printCreated({ rules, files: report.changed, ignored, messages });
  printNextSteps(config.journal, messages);
}
