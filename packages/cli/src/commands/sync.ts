// `cyberzavod sync`: заново смотрит на стек, ставит в конфиг текущую версию harness и приводит
// файлы агента к harness. `--check` только сравнивает — так проверки проекта ловят устаревшие
// файлы.

import { syncClaude, type ClaudeInstallation, type SyncReport } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { LEGACY_TOOL_FILE, PROJECT_CONFIG_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { detectProject, stackOf } from "../detect.ts";
import { HARNESS_VERSION, type Installation } from "../installation/installation.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { hasLegacyTool, removeLegacyTool } from "./legacy-tool.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

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

function withLegacyTool(report: SyncReport, isLegacyToolRemoved: boolean): SyncReport {
  return isLegacyToolRemoved
    ? { ...report, removed: [LEGACY_TOOL_FILE, ...report.removed] }
    : report;
}

function isClean(report: SyncReport): boolean {
  return report.changed.length + report.removed.length + report.conflicts.length === 0;
}

/** Что расходится с запущенной версией: файлы агента и версия harness в конфиге. */
export interface ProjectFilesInspection {
  /** Файлы агента, которые устарели, лишние или написаны человеком; в том числе прежний CLI. */
  report: SyncReport;
  /** Версия harness в конфиге проекта. */
  configVersion: string;
  /** Версия в конфиге не совпадает с версией запущенного CLI. */
  isHarnessOutdated: boolean;
}

/**
 * Сравнивает файлы агента проекта с тем, что собрала бы запущенная версия, ничего не записывая.
 * @param {ProjectAt} project Подключённый проект.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @returns {Promise<ProjectFilesInspection>} Расхождения файлов и версии.
 * @throws {Error} Если файлы агента не собрать.
 */
export async function inspectProjectFiles(
  project: ProjectAt,
  installation: Installation,
): Promise<ProjectFilesInspection> {
  const claudeReport = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallationOf(installation),
    check: true,
  });
  const isLegacyToolPresent = await hasLegacyTool(project.root);

  return {
    report: withLegacyTool(claudeReport, isLegacyToolPresent),
    configVersion: project.config.harness,
    isHarnessOutdated: project.config.harness !== HARNESS_VERSION,
  };
}

/**
 * Проверяет, что файлы агента актуальны и CLI прежних версий из проекта убран, ничего не записывая.
 * @param {string} directory Каталог внутри проекта.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<boolean>} true, если синхронизировать нечего.
 * @throws {Error} Если проекта нет или файлы агента не собрать.
 */
export async function checkProject(
  directory: string,
  installation: Installation,
  messages: CliMessages,
): Promise<boolean> {
  const project = await requireProjectAt(directory);
  const { report, configVersion, isHarnessOutdated } = await inspectProjectFiles(
    project,
    installation,
  );

  if (isHarnessOutdated) {
    console.log(
      messages.sync.harnessMismatch({
        file: PROJECT_CONFIG_FILE,
        configVersion,
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
 * Синхронизирует проект с harness: обновляет конфиг и файлы агента, убирает CLI прежних версий.
 * @param {string} directory Каталог внутри проекта.
 * @param {SyncCommandOptions} options Перезаписать ли файлы человека, версия, сообщения.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {Error} Если проекта нет или файлы агента не собрать.
 */
export async function syncProject(directory: string, options: SyncCommandOptions): Promise<void> {
  const { force, installation, messages } = options;
  const project = await requireProjectAt(directory);
  const config = await refreshedConfig(project.root, project.config);

  await writeProjectConfig(project.root, config);

  const isLegacyToolPresent = await hasLegacyTool(project.root);

  if (isLegacyToolPresent) await removeLegacyTool(project.root);

  const report = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallationOf(installation),
    force,
  });

  printWrittenReport(withLegacyTool(report, isLegacyToolPresent), messages);
}
