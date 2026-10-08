// `cyberzavod init`: подключает проект в текущем каталоге — показывает, что найдено и что
// появится, спрашивает одно «Продолжить?», пишет конфиг, AGENTS.md и файлы агента. Проект
// остаётся на своём месте: Cyberzavod его не клонирует и не переносит.

import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncClaude } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, readProjectConfig, writeProjectConfig } from "@cyberzavod/storage";
import type { Confirmation } from "../confirmation.ts";
import { detectProject } from "../detect.ts";
import { CommandError } from "../errors.ts";
import { readOptionalText } from "../files.ts";
import { initialConfigOf, type InitOverrides } from "../initial-config.ts";
import type { Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { appendIgnoreEntry, captureIgnoreEntry, GITIGNORE_FILE } from "./gitignore.ts";

const RULES_FILE = "AGENTS.md";
const LEGACY_ENTRYPOINT = "CLAUDE.md";
const AGENT_DIRECTORY = ".claude/";
const SUMMARY_INDENT = "  ";
const LIST_SEPARATOR = ", ";
const PATH_SEPARATORS = /[\\/]/;

function starterRules(template: string, name: string, commands: string[]): string {
  const verification =
    commands.length === 0
      ? "  - пока не заданы"
      : commands.map((command) => `  - \`${command}\``).join("\n");

  return template.replace("{{name}}", name).replace("{{verification}}", verification);
}

// Что будет с правилами проекта: AGENTS.md уже есть и не меняется; написанный человеком
// CLAUDE.md и есть правила, он переезжает в AGENTS.md, а на его месте появится тонкий CLAUDE.md
// от генератора; иначе AGENTS.md пишется из заготовки.
type RulesPlan = "kept" | "moved" | "starter";

async function planRules(root: string): Promise<RulesPlan> {
  const hasRules = (await readOptionalText(path.join(root, RULES_FILE))) !== undefined;

  if (hasRules) return "kept";

  const hasLegacyEntrypoint =
    (await readOptionalText(path.join(root, LEGACY_ENTRYPOINT))) !== undefined;

  return hasLegacyEntrypoint ? "moved" : "starter";
}

function rulesSummary(plan: RulesPlan, messages: CliMessages): string {
  switch (plan) {
    case "kept":
      return messages.init.rulesKept(RULES_FILE);
    case "moved":
      return messages.init.rulesMoved({ from: LEGACY_ENTRYPOINT, to: RULES_FILE });
    case "starter":
      return messages.init.rulesStarter(RULES_FILE);
    default:
      return plan satisfies never;
  }
}

interface RulesApplication {
  root: string;
  plan: RulesPlan;
  template: string;
  name: string;
  commands: string[];
}

async function applyRules({
  root,
  plan,
  template,
  name,
  commands,
}: RulesApplication): Promise<void> {
  const rules = path.join(root, RULES_FILE);

  switch (plan) {
    case "kept":
      return;
    case "moved":
      await rename(path.join(root, LEGACY_ENTRYPOINT), rules);

      return;
    case "starter":
      await writeFile(rules, starterRules(template, name, commands));

      return;
    default:
      return plan satisfies never;
  }
}

function slashed(file: string): string {
  return file.split(PATH_SEPARATORS).join("/");
}

// Файлы, которые появятся, называются так, как их увидит человек: проект и агент — без
// перечисления их содержимого.
function createdFiles(ignoreEntry: string | undefined): string[] {
  const files = [slashed(PROJECT_CONFIG_FILE), LEGACY_ENTRYPOINT, AGENT_DIRECTORY];

  return ignoreEntry === undefined ? files : [...files, GITIGNORE_FILE];
}

interface Summary {
  config: ProjectConfig;
  rulesPlan: RulesPlan;
  ignoreEntry: string | undefined;
  messages: CliMessages;
}

function printSummary({ config, rulesPlan, ignoreEntry, messages }: Summary): void {
  const { init } = messages;
  const checks =
    config.verification.commands.length === 0
      ? init.checksMissing(slashed(PROJECT_CONFIG_FILE))
      : init.checks(config.verification.commands.join(LIST_SEPARATOR));
  const details = [
    init.projectId(config.projectId),
    checks,
    rulesSummary(rulesPlan, messages),
    init.journal(config.journal),
    init.files(createdFiles(ignoreEntry).join(LIST_SEPARATOR)),
  ];

  console.log(init.summaryTitle);

  for (const detail of details) console.log(`${SUMMARY_INDENT}${detail}`);

  console.log(init.overrideHint);
}

// Каждый путь сворачивается до верхнего элемента: `.claude/agents/planner.md` → `.claude/`.
function topLevelEntry(file: string): string {
  const [first = file, ...rest] = file.split(PATH_SEPARATORS);

  return rest.length === 0 ? first : `${first}/`;
}

function commitPaths(files: readonly string[]): string[] {
  const entries = files.map(topLevelEntry);

  return [...new Set(entries)];
}

interface Done {
  changed: readonly string[];
  isRulesFileWritten: boolean;
  isIgnoreEntryAdded: boolean;
  messages: CliMessages;
}

function printDone({ changed, isRulesFileWritten, isIgnoreEntryAdded, messages }: Done): void {
  const files = [
    PROJECT_CONFIG_FILE,
    ...(isRulesFileWritten ? [RULES_FILE] : []),
    ...changed,
    ...(isIgnoreEntryAdded ? [GITIGNORE_FILE] : []),
  ];
  const paths = commitPaths(files).join(LIST_SEPARATOR);

  console.log(
    `\n${messages.init.done}\n${messages.init.commit(paths)}\n${messages.init.nextSteps}`,
  );
}

/** Что нужно подключению проекта: подтверждение, флаги, версия Cyberzavod и тексты. */
export interface InitOptions {
  /** Спрашивает «Продолжить?» или соглашается без вопроса. */
  confirm: Confirmation;
  /** Значения флагов `init`: они перекрывают найденное. */
  overrides: InitOverrides;
  /** Запущенная версия Cyberzavod. */
  installation: Installation;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/**
 * Подключает проект: показывает найденное, спрашивает «Продолжить?», пишет конфиг и файлы
 * агента. После отказа ничего не пишет.
 * @param {string} root Корень проекта — каталог, из которого запущена команда.
 * @param {InitOptions} options Подтверждение, флаги, версия Cyberzavod, сообщения.
 * @returns {Promise<void>} Готово, когда всё записано или человек отказался.
 * @throws {CommandError} Если проект уже подключён или флаг задан неверно.
 */
export async function initProject(root: string, options: InitOptions): Promise<void> {
  const { confirm, overrides, installation, messages } = options;
  const isConnected = (await readProjectConfig(root)) !== undefined;

  if (isConnected) {
    throw new CommandError((m) => m.errors.alreadyConnected(PROJECT_CONFIG_FILE));
  }

  const detected = await detectProject(root);
  const config = initialConfigOf({ detected, harness: installation.harness, overrides });
  const rulesPlan = await planRules(root);
  const ignoreEntry = captureIgnoreEntry(config.journal);

  printSummary({ config, rulesPlan, ignoreEntry, messages });

  const isConfirmed = await confirm(messages.init.confirm);

  if (!isConfirmed) {
    console.log(messages.init.cancelled);

    return;
  }

  await writeProjectConfig(root, config);
  await applyRules({
    root,
    plan: rulesPlan,
    template: installation.rulesTemplate,
    name: detected.name,
    commands: config.verification.commands,
  });

  const isIgnoreEntryAdded =
    ignoreEntry !== undefined && (await appendIgnoreEntry(root, ignoreEntry));
  const report = await syncClaude({
    projectDirectory: root,
    installation: { harness: installation.harness, templates: installation.claudeTemplates },
  });

  printDone({
    changed: report.changed,
    isRulesFileWritten: rulesPlan !== "kept",
    isIgnoreEntryAdded,
    messages,
  });
}
