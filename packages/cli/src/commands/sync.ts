// `cyberzavod sync`: заново смотрит на стек, ставит в конфиг текущую версию harness и приводит
// файлы агента к harness. `--check` и `--diff` только показывают, что изменится: первый выходит с
// кодом 1, если что-то устарело (так проверки проекта ловят устаревшие файлы), второй — с кодом 0.

import {
  previewClaude,
  requireWritable,
  syncClaude,
  type ClaudeInstallation,
  type SyncReport,
} from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { LEGACY_TOOL_FILE, PROJECT_CONFIG_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { detectProject, stackOf } from "../detect.ts";
import { HARNESS_VERSION, type Installation } from "../installation/installation.ts";
import { printJson } from "../json-output.ts";
import type { CliMessages } from "../messages/cli-messages.ts";
import { hasLegacyTool, removeLegacyTool } from "./legacy-tool.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

/** Что нужно синхронизации: перезаписывать ли файлы человека, версия Cyberzavod и тексты. */
export interface SyncCommandOptions {
  /** Перезаписать файлы, которые написал человек или исправил руками. */
  force: boolean;
  /** Запущенная версия Cyberzavod. */
  installation: Installation;
  /** Сообщения на выбранном языке. */
  messages: CliMessages;
}

/** Как показать, что изменит sync: текстом для человека или JSON для скриптов. */
export interface PreviewOptions {
  installation: Installation;
  messages: CliMessages;
  isJson: boolean;
}

/**
 * Состояние файлов агента: всё совпадает (`current`), sync их обновит (`outdated`), sync
 * остановится на файлах человека или исправленных руками (`blocked`).
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

function claudeInstallationOf(installation: Installation): ClaudeInstallation {
  return { harness: installation.harness, templates: installation.claudeTemplates };
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
 * Состояние файлов агента по отчёту сравнения.
 * @param {SyncReport} report Отчёт `sync` в режиме проверки.
 * @returns {FilesStatus} Совпадают, устарели или sync остановится на чужих файлах.
 */
export function filesStatusOf(report: SyncReport): FilesStatus {
  if (report.conflicts.length + report.edited.length > 0) return "blocked";

  return isClean(report) ? "current" : "outdated";
}

/** Что расходится с запущенной версией: файлы агента и версия harness в конфиге. */
export interface ProjectFilesInspection {
  /** Файлы агента, которые устарели, лишние, написаны человеком или исправлены руками. */
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
 * Показывает, что изменит sync, ничего не записывая.
 * @param {string} directory Каталог внутри проекта.
 * @param {PreviewOptions} options Версия, сообщения и вид вывода.
 * @returns {Promise<boolean>} true, если синхронизировать нечего.
 * @throws {Error} Если проекта нет или файлы агента не собрать.
 */
export async function previewProject(directory: string, options: PreviewOptions): Promise<boolean> {
  const { installation, messages, isJson } = options;
  const project = await requireProjectAt(directory);
  const inspection = await inspectProjectFiles(project, installation);

  if (isJson) printPreviewJson(inspection);
  else printPreviewText(inspection, messages);

  return isClean(inspection.report) && !inspection.isHarnessOutdated;
}

/**
 * Синхронизирует проект с harness: обновляет конфиг и файлы агента, убирает CLI прежних версий.
 * Если генератор упрётся в файлы человека, не меняется ничего, в том числе конфиг.
 * @param {string} directory Каталог внутри проекта.
 * @param {SyncCommandOptions} options Перезаписать ли файлы человека, версия, сообщения.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {Error} Если проекта нет или файлы агента не собрать.
 */
export async function syncProject(directory: string, options: SyncCommandOptions): Promise<void> {
  const { force, installation, messages } = options;
  const project = await requireProjectAt(directory);
  const config = await refreshedConfig(project.root, project.config);
  const claudeInstallation = claudeInstallationOf(installation);

  // Файлы человека ищутся до первой записи: при конфликте конфиг остаётся прежним.
  if (!force) {
    requireWritable(await previewClaude({ root: project.root, config }, claudeInstallation));
  }

  await writeProjectConfig(project.root, config);

  const isLegacyToolPresent = await hasLegacyTool(project.root);

  if (isLegacyToolPresent) await removeLegacyTool(project.root);

  const report = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallation,
    force,
  });

  printWrittenReport(withLegacyTool(report, isLegacyToolPresent), messages);
}
