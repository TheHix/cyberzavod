// `cyberzavod disconnect`: removes Cyberzavod from the project, only what it wrote itself.
// First shows the plan and asks "Continue?"; the code, AGENTS.md, the journal, the human's own
// settings and hooks stay.

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

/** What disconnecting needs: confirmation and texts. */
export interface DisconnectCommandOptions {
  /** Asks "Continue?", agrees without asking, or refuses. */
  confirm: Confirmation;
  messages: CliMessages;
}

/** Disconnect outcome: everything removed, or the human refused and nothing changed. */
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
 * Removes Cyberzavod from the project after the human agrees: agent files and their manifest, its
 * hooks and denials in the Claude Code settings, the project config. The code, AGENTS.md, the
 * journal, the `.gitignore` line for raw logs and everything else in the settings stay.
 * @param {string} directory Directory inside the project.
 * @param {DisconnectCommandOptions} options Confirmation and texts.
 * @returns {Promise<DisconnectOutcome>} Removed or cancelled.
 * @throws {Error} If the directory is not in a project.
 * @throws {Error} If the settings do not parse: then nothing is changed.
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
