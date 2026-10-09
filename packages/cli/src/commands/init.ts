// `cyberzavod init`: connects the project in the current directory: shows what was found and what
// will appear, asks a single "Continue?", writes the config, AGENTS.md and agent files. The project
// stays where it is: Cyberzavod neither clones nor moves it.

import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { previewClaude, syncClaude } from "@cyberzavod/adapter-claude";
import { RULES_TODO_MARK, type ProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, readProjectConfig, writeProjectConfig } from "@cyberzavod/storage";
import type { Confirmation } from "../confirmation.ts";
import { detectProject } from "../detect.ts";
import { CommandError } from "../errors.ts";
import { readOptionalText } from "../files.ts";
import { initialConfigOf, type InitOverrides } from "../initial-config.ts";
import type { Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { appendIgnoreEntry, captureIgnoreEntry, GITIGNORE_FILE } from "./gitignore.ts";
import { requireProjectAt } from "./project.ts";
import { filesStatusOf, inspectProjectFiles } from "./sync.ts";

/** The project's rules file for agents, in its root. */
export const RULES_FILE = "AGENTS.md";
const LEGACY_ENTRYPOINT = "CLAUDE.md";
const AGENT_DIRECTORY = ".claude/";
const SUMMARY_INDENT = "  ";
const LIST_SEPARATOR = ", ";
const PATH_SEPARATORS = /[\\/]/;
const TODO_PLACEHOLDER = "{{todo}}";

function starterRules(template: string, name: string, commands: string[]): string {
  const verification =
    commands.length === 0
      ? `  - not set yet ${RULES_TODO_MARK}`
      : commands.map((command) => `  - \`${command}\``).join("\n");

  return template
    .replace("{{name}}", name)
    .replace("{{verification}}", verification)
    .replaceAll(TODO_PLACEHOLDER, RULES_TODO_MARK);
}

// What happens to the project rules: AGENTS.md already exists and is not changed; a CLAUDE.md
// written by the human is the rules, so it moves to AGENTS.md, and a thin generated CLAUDE.md
// takes its place; otherwise AGENTS.md is written from the starter.
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

// Files that will appear are named the way the human will see them: the project and the agent,
// without listing their contents.
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

// Each path collapses to its top element: `.claude/agents/planner.md` → `.claude/`.
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

/** What connecting a project needs: confirmation, flags, Cyberzavod version and texts. */
export interface InitOptions {
  /** Asks "Continue?" or agrees without asking. */
  confirm: Confirmation;
  /** `init` flag values: they override what was found. */
  overrides: InitOverrides;
  /** The running Cyberzavod version. */
  installation: Installation;
  /** Messages in the chosen language. */
  messages: CliMessages;
}

// `init` does not change an already connected project; it says whether it is fine and what to do
// next.
async function reportConnected(root: string, options: InitOptions): Promise<boolean> {
  const { installation, messages } = options;
  const project = await requireProjectAt(root);
  const { report, isHarnessOutdated } = await inspectProjectFiles(project, installation);
  const status = filesStatusOf(report);
  const isCurrent = status === "current" && !isHarnessOutdated;

  console.log(messages.init.alreadyConnected);
  console.log(messages.init.configValid);
  console.log(isCurrent ? messages.init.filesCurrent : messages.init.filesOutdated);
  console.log(isCurrent ? messages.init.nothingToDo : messages.init.runSync);

  return isCurrent;
}

// Files the generator would write over are looked for before the first write: so a refusal leaves
// the project untouched. A handwritten CLAUDE.md that will become AGENTS.md is not in the way.
async function blockingFiles(
  root: string,
  config: ProjectConfig,
  rulesPlan: RulesPlan,
  installation: Installation,
): Promise<string[]> {
  const claudeInstallation = {
    harness: installation.harness,
    templates: installation.claudeTemplates,
  };
  const report = await previewClaude({ root, config }, claudeInstallation);
  const blocked = [...report.conflicts, ...report.edited];

  return rulesPlan === "moved" ? blocked.filter((file) => file !== LEGACY_ENTRYPOINT) : blocked;
}

/**
 * Connects the project: shows what was found, asks "Continue?", writes the config and agent
 * files. After a refusal writes nothing. An already connected project is checked, not changed.
 * @param {string} root Project root: the directory the command was run from.
 * @param {InitOptions} options Confirmation, flags, Cyberzavod version, messages.
 * @returns {Promise<boolean>} true if the project is connected and its files are current, or the
 *   human refused; false if the connected project needs sync.
 * @throws {CommandError} If a flag is invalid or the human's files block connecting: then
 *   nothing is written.
 */
export async function initProject(root: string, options: InitOptions): Promise<boolean> {
  const { confirm, overrides, installation, messages } = options;
  const isConnected = (await readProjectConfig(root)) !== undefined;

  if (isConnected) return reportConnected(root, options);

  const detected = await detectProject(root);
  const config = initialConfigOf({ detected, harness: installation.harness, overrides });
  const rulesPlan = await planRules(root);
  const ignoreEntry = captureIgnoreEntry(config.journal);
  const blocked = await blockingFiles(root, config, rulesPlan, installation);

  if (blocked.length > 0) {
    const files = blocked.join(LIST_SEPARATOR);

    throw new CommandError((m) => m.errors.initBlocked({ files, rulesFile: RULES_FILE }));
  }

  printSummary({ config, rulesPlan, ignoreEntry, messages });

  const isConfirmed = await confirm(messages.init.confirm);

  if (!isConfirmed) {
    console.log(messages.init.cancelled);

    return true;
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
    changed: [...report.added, ...report.updated],
    isRulesFileWritten: rulesPlan !== "kept",
    isIgnoreEntryAdded,
    messages,
  });

  return true;
}
