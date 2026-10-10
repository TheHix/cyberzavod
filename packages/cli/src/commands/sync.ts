// `cyberzavod sync`: looks at the stack again, sets the current harness version in the config and
// brings the agent files in line with the harness. `--check` and `--diff` only show what will
// change: the first exits with code 1 if anything is outdated (so project checks catch outdated
// files), the second with code 0.

import type { SyncReport } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { LEGACY_TOOL_FILE, PROJECT_CONFIG_FILE, writeProjectConfig } from "@cyberzavod/storage";
import type { AgentAdapter } from "../agents/agent-adapter.ts";
import { adapterFor } from "../agents/host-agent.ts";
import type { Adapters } from "../agents/registry.ts";
import { detectProject, stackOf } from "../detect.ts";
import { HARNESS_VERSION, type Installation } from "../installation/installation.ts";
import { printJson } from "../json-output.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { hasLegacyTool, removeLegacyTool } from "./legacy-tool.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

/** What sync needs: whether to overwrite the human's files, Cyberzavod version and texts. */
export interface SyncCommandOptions {
  /** Overwrite files the human wrote or edited by hand. */
  force: boolean;
  /** The running Cyberzavod version. */
  installation: Installation;
  /** Messages in the chosen language. */
  messages: CliMessages;
  /** Adapters of the agents the CLI can drive. */
  adapters: Adapters;
}

/** How to show what sync will change: as text for the human or as JSON for scripts. */
export interface PreviewOptions {
  installation: Installation;
  messages: CliMessages;
  adapters: Adapters;
  isJson: boolean;
}

/**
 * State of the agent files: everything matches (`current`), sync will update them (`outdated`),
 * sync will stop at files written or edited by the human (`blocked`).
 */
export type FilesStatus = "current" | "outdated" | "blocked";

async function refreshedConfig(root: string, config: ProjectConfig): Promise<ProjectConfig> {
  const detected = await detectProject(root);

  return { ...config, harness: HARNESS_VERSION, stack: stackOf(detected) };
}

function printFiles(title: string, files: readonly string[]): void {
  if (files.length === 0) return;

  const lines = files.map((file) => `  ${file}`);

  console.log(`${title}:\n${lines.join("\n")}`);
}

function printWrittenReport(report: SyncReport, messages: CliMessages): void {
  const { sync } = messages;

  printFiles(sync.added, report.added);
  printFiles(sync.updated, report.updated);
  printFiles(sync.removed, report.removed);

  if (isClean(report)) console.log(sync.upToDate);
}

function printPreview(report: SyncReport, messages: CliMessages): void {
  const { sync } = messages;

  printFiles(sync.willAdd, report.added);
  printFiles(sync.willUpdate, report.updated);
  printFiles(sync.willRemove, report.removed);
  printFiles(sync.yours, report.conflicts);
  printFiles(sync.edited, report.edited);
  console.log(sync.neverTouched);
}

function withLegacyTool(report: SyncReport, isLegacyToolRemoved: boolean): SyncReport {
  return isLegacyToolRemoved
    ? { ...report, removed: [LEGACY_TOOL_FILE, ...report.removed] }
    : report;
}

function isClean(report: SyncReport): boolean {
  const lists = [report.added, report.updated, report.removed, report.conflicts, report.edited];

  return lists.every((files) => files.length === 0);
}

/**
 * State of the agent files from the comparison report.
 * @param {SyncReport} report `sync` report in check mode.
 * @returns {FilesStatus} Match, outdated, or sync will stop at someone else's files.
 */
export function filesStatusOf(report: SyncReport): FilesStatus {
  if (report.conflicts.length + report.edited.length > 0) return "blocked";

  return isClean(report) ? "current" : "outdated";
}

/** What differs from the running version: the agent files and the harness version in the config. */
export interface ProjectFilesInspection {
  /** Agent files that are outdated, extra, written by the human or edited by hand. */
  report: SyncReport;
  /** Harness version in the project config. */
  configVersion: string;
  /** The config version does not match the running CLI version. */
  isHarnessOutdated: boolean;
}

/**
 * Compares the project's agent files with what the running version would build, writing nothing.
 * @param {ProjectAt} project Connected project.
 * @param {Installation} installation The running Cyberzavod version.
 * @param {AgentAdapter} adapter Adapter of the agent that drives the project.
 * @returns {Promise<ProjectFilesInspection>} File and version differences.
 * @throws {Error} If the agent files cannot be built.
 */
export async function inspectProjectFiles(
  project: ProjectAt,
  installation: Installation,
  adapter: AgentAdapter,
): Promise<ProjectFilesInspection> {
  const adapterReport = await adapter.inspectFiles(project.root, installation);
  const isLegacyToolPresent = await hasLegacyTool(project.root);

  return {
    report: withLegacyTool(adapterReport, isLegacyToolPresent),
    configVersion: project.config.harness,
    isHarnessOutdated: project.config.harness !== HARNESS_VERSION,
  };
}

function printPreviewText(inspection: ProjectFilesInspection, messages: CliMessages): void {
  const { report, configVersion, isHarnessOutdated } = inspection;
  const status = filesStatusOf(report);

  if (isHarnessOutdated) {
    console.log(
      messages.sync.harnessMismatch({
        file: PROJECT_CONFIG_FILE,
        configVersion,
        cliVersion: HARNESS_VERSION,
      }),
    );
  }

  printPreview(report, messages);
  console.log(conclusionOf(status, isHarnessOutdated, messages));
}

function conclusionOf(status: FilesStatus, isHarnessOutdated: boolean, messages: CliMessages) {
  switch (status) {
    case "current":
      return isHarnessOutdated ? messages.sync.filesOutdated : messages.sync.upToDate;
    case "outdated":
      return messages.sync.filesOutdated;
    case "blocked":
      return messages.sync.blocked;
    default:
      return status satisfies never;
  }
}

function printPreviewJson(inspection: ProjectFilesInspection): void {
  const { report, configVersion, isHarnessOutdated } = inspection;
  const status = filesStatusOf(report);
  const overall = status === "current" && isHarnessOutdated ? "outdated" : status;

  printJson("sync", {
    status: overall,
    harness: { config: configVersion, cli: HARNESS_VERSION, isOutdated: isHarnessOutdated },
    files: report,
  });
}

/**
 * Shows what sync will change, writing nothing.
 * @param {string} directory Directory inside the project.
 * @param {PreviewOptions} options Version, messages, adapters and output format.
 * @returns {Promise<boolean>} true if there is nothing to sync.
 * @throws {Error} If there is no project or the agent files cannot be built.
 */
export async function previewProject(directory: string, options: PreviewOptions): Promise<boolean> {
  const { installation, messages, adapters, isJson } = options;
  const project = await requireProjectAt(directory);
  const adapter = adapterFor(project.config, adapters);
  const inspection = await inspectProjectFiles(project, installation, adapter);

  if (isJson) printPreviewJson(inspection);
  else printPreviewText(inspection, messages);

  return isClean(inspection.report) && !inspection.isHarnessOutdated;
}

/**
 * Syncs the project with the harness: updates the config and agent files, removes the CLI of
 * earlier versions. If the generator runs into the human's files, nothing changes, the config
 * included.
 * @param {string} directory Directory inside the project.
 * @param {SyncCommandOptions} options Whether to overwrite the human's files, version, messages,
 *   adapters.
 * @returns {Promise<void>} Done when everything is written.
 * @throws {Error} If there is no project or the agent files cannot be built.
 */
export async function syncProject(directory: string, options: SyncCommandOptions): Promise<void> {
  const { force, installation, messages, adapters } = options;
  const project = await requireProjectAt(directory);
  const adapter = adapterFor(project.config, adapters);
  const config = await refreshedConfig(project.root, project.config);

  // The human's files are looked for before the first write: on a conflict the config stays as it
  // was.
  if (!force) {
    adapter.requireWritable(
      await adapter.previewFiles({ root: project.root, config }, installation),
    );
  }

  await writeProjectConfig(project.root, config);

  const isLegacyToolPresent = await hasLegacyTool(project.root);

  if (isLegacyToolPresent) await removeLegacyTool(project.root);

  const report = await adapter.syncFiles({
    projectDirectory: project.root,
    installation,
    force,
  });

  printWrittenReport(withLegacyTool(report, isLegacyToolPresent), messages);
}
