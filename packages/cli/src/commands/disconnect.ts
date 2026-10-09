// `cyberzavod disconnect`: убирает Cyberzavod из проекта — только то, что он сам записал.
// Сначала показывает план и спрашивает «Продолжить?»; код, AGENTS.md, журнал, свои настройки
// и хуки человека остаются.

import { rm } from "node:fs/promises";
import path from "node:path";
import { disconnectClaude, SETTINGS_FILE, type DisconnectPlan } from "@cyberzavod/adapter-claude";
import { LEGACY_TOOL_FILE, MARKER_DIRECTORY, PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import type { Confirmation } from "../confirmation.ts";
import { removeDirectoryIfEmpty } from "../files.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { captureIgnoreEntry } from "./gitignore.ts";
import { hasLegacyTool, removeLegacyTool } from "./legacy-tool.ts";
import { RULES_FILE } from "./init.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

const LIST_INDENT = "  ";

/** Что нужно отключению: подтверждение и тексты. */
export interface DisconnectCommandOptions {
  /** Спрашивает «Продолжить?», соглашается без вопроса или отказывает. */
  confirm: Confirmation;
  messages: CliMessages;
}

/** Итог отключения: всё убрано или человек отказался и ничего не изменилось. */
export type DisconnectOutcome = "removed" | "cancelled";

function slashed(file: string): string {
  return file.split(path.sep).join("/");
}

function settingsLine(plan: DisconnectPlan, messages: CliMessages): string[] {
  switch (plan.settings) {
    case "unchanged":
      return [];
    case "updated":
      return [messages.disconnect.settingsUpdated(SETTINGS_FILE)];
    case "removed":
      return [messages.disconnect.settingsRemoved(SETTINGS_FILE)];
    default:
      return plan.settings satisfies never;
  }
}

function removedLines(plan: DisconnectPlan, hasLegacy: boolean, messages: CliMessages): string[] {
  return [
    ...plan.removed,
    ...settingsLine(plan, messages),
    ...(hasLegacy ? [LEGACY_TOOL_FILE] : []),
    slashed(PROJECT_CONFIG_FILE),
  ];
}

function keptLines(project: ProjectAt, plan: DisconnectPlan, messages: CliMessages): string[] {
  const { disconnect } = messages;
  const journal = slashed(path.relative(project.root, project.journal));
  const ignoreEntry = captureIgnoreEntry(project.config.journal);
  const edited = plan.edited.map((file) => disconnect.editedFile(file));

  return [
    disconnect.keepSource,
    RULES_FILE,
    disconnect.keepJournal(journal),
    ...(ignoreEntry === undefined ? [] : [disconnect.keepIgnoreEntry(ignoreEntry)]),
    disconnect.keepSettings,
    ...edited,
  ];
}

function printList(title: string, lines: readonly string[]): void {
  console.log(title);

  for (const line of lines) console.log(`${LIST_INDENT}${line}`);

  console.log("");
}

/**
 * Убирает Cyberzavod из проекта после согласия человека: файлы агента и их манифест, свои хуки и
 * запреты в настройках Claude Code, конфиг проекта. Код, AGENTS.md, журнал, строка `.gitignore`
 * для сырых журналов и всё чужое в настройках остаются.
 * @param {string} directory Каталог внутри проекта.
 * @param {DisconnectCommandOptions} options Подтверждение и тексты.
 * @returns {Promise<DisconnectOutcome>} Убрано или отменено.
 * @throws {Error} Если каталог не в проекте.
 * @throws {Error} Если настройки не разобраны: тогда ничего не изменено.
 */
export async function disconnectProject(
  directory: string,
  options: DisconnectCommandOptions,
): Promise<DisconnectOutcome> {
  const { confirm, messages } = options;
  const project = await requireProjectAt(directory);
  const plan = await disconnectClaude({ projectDirectory: project.root, check: true });
  const hasLegacy = await hasLegacyTool(project.root);

  printList(messages.disconnect.willRemove, removedLines(plan, hasLegacy, messages));
  printList(messages.disconnect.willKeep, keptLines(project, plan, messages));

  const isConfirmed = await confirm(messages.disconnect.confirm);

  if (!isConfirmed) {
    console.log(messages.disconnect.cancelled);

    return "cancelled";
  }

  await disconnectClaude({ projectDirectory: project.root });

  if (hasLegacy) await removeLegacyTool(project.root);

  await rm(path.join(project.root, PROJECT_CONFIG_FILE), { force: true });
  await removeDirectoryIfEmpty(path.join(project.root, MARKER_DIRECTORY));
  console.log(messages.disconnect.done(RULES_FILE));

  return "removed";
}
