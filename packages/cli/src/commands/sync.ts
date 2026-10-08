// `cyberzavod sync`: заново смотрит на стек, ставит в конфиг текущую версию harness и приводит
// файлы агента к harness. `--check` только сравнивает — так проверки проекта ловят устаревшие
// файлы.

import { syncClaude, type ClaudeInstallation, type SyncReport } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, TOOL_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { detectProject, stackOf } from "../detect.ts";
import { HARNESS_VERSION, toolOf, type Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { requireProjectAt } from "./project.ts";
import { isToolFileOutdated, updateToolFile } from "./tool-file.ts";

/** Что нужно синхронизации: перезаписывать ли файлы человека, версия Cyberzavod и тексты. */
export interface SyncCommandOptions {
  /** Перезаписать файлы, которые написал человек, а не генератор. */
  force: boolean;
  /** Запущенная версия Cyberzavod. */
  installation: Installation;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

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
  printFiles(messages.sync.written, report.changed);
  printFiles(messages.sync.removed, report.removed);
  printFiles(messages.sync.writtenByHuman, report.conflicts);
}

function printOutdatedReport(report: SyncReport, messages: CliMessages): void {
  printFiles(messages.sync.outdated, report.changed);
  printFiles(messages.sync.extra, report.removed);
  printFiles(messages.sync.writtenByHuman, report.conflicts);
}

function claudeInstallationOf(installation: Installation): ClaudeInstallation {
  return { harness: installation.harness, templates: installation.claudeTemplates };
}

function withTool(report: SyncReport, isToolChanged: boolean): SyncReport {
  return isToolChanged ? { ...report, changed: [TOOL_FILE, ...report.changed] } : report;
}

function isClean(report: SyncReport): boolean {
  return report.changed.length + report.removed.length + report.conflicts.length === 0;
}

/**
 * Проверяет, что файлы агента и собранный CLI в проекте актуальны, ничего не записывая.
 * @param {string} directory Каталог внутри проекта.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<boolean>} true, если синхронизировать нечего.
 * @throws {Error} Если проекта нет, CLI запущен из исходников или файлы агента не собрать.
 */
export async function checkProject(
  directory: string,
  installation: Installation,
  messages: CliMessages,
): Promise<boolean> {
  const project = await requireProjectAt(directory);
  const tool = toolOf(installation);
  const claudeReport = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallationOf(installation),
    check: true,
  });
  const isToolOutdated = await isToolFileOutdated(project.root, tool);
  const report = withTool(claudeReport, isToolOutdated);
  const isHarnessOutdated = project.config.harness !== HARNESS_VERSION;

  if (isHarnessOutdated) {
    console.log(
      messages.sync.harnessMismatch({
        file: PROJECT_CONFIG_FILE,
        configVersion: project.config.harness,
        cliVersion: HARNESS_VERSION,
      }),
    );
  }

  printOutdatedReport(report, messages);

  const isUpToDate = isClean(report) && !isHarnessOutdated;

  if (!isUpToDate) console.log(messages.sync.filesOutdated);

  return isUpToDate;
}

/**
 * Синхронизирует проект с harness: обновляет конфиг, собранный CLI и файлы агента.
 * @param {string} directory Каталог внутри проекта.
 * @param {SyncCommandOptions} options Перезаписать ли файлы человека, версия, сообщения.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {Error} Если проекта нет, CLI запущен из исходников или файлы агента не собрать.
 */
export async function syncProject(directory: string, options: SyncCommandOptions): Promise<void> {
  const { force, installation, messages } = options;
  const project = await requireProjectAt(directory);
  const tool = toolOf(installation);
  const config = await refreshedConfig(project.root, project.config);

  await writeProjectConfig(project.root, config);

  const isToolChanged = await updateToolFile(project.root, tool);
  const report = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallationOf(installation),
    force,
  });

  printWrittenReport(withTool(report, isToolChanged), messages);
}
