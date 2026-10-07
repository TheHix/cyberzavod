// `cyberzavod sync`: заново смотрит на стек, ставит в конфиг текущую версию harness и приводит
// файлы агента к harness. `--check` только сравнивает — так проверки проекта ловят устаревшие
// файлы.

import { syncClaude, type ClaudeInstallation, type SyncReport } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, TOOL_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { detectProject, stackOf } from "../detect.ts";
import { HARNESS_VERSION, toolOf, type Installation } from "../installation/installation.ts";
import { requireProjectAt } from "./project.ts";
import { isToolFileOutdated, updateToolFile } from "./tool-file.ts";

/** Настройки записи: перезаписывать ли файлы, написанные человеком. */
export interface SyncCommandOptions {
  force: boolean;
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

function printWrittenReport(report: SyncReport): void {
  printFiles("записаны", report.changed);
  printFiles("удалены", report.removed);
  printFiles("написаны человеком", report.conflicts);
}

function printOutdatedReport(report: SyncReport): void {
  printFiles("устарели", report.changed);
  printFiles("лишние", report.removed);
  printFiles("написаны человеком", report.conflicts);
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
 * @returns {Promise<boolean>} true, если синхронизировать нечего.
 * @throws {Error} Если проекта нет, CLI запущен из исходников или файлы агента не собрать.
 */
export async function checkProject(
  directory: string,
  installation: Installation,
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
      `${PROJECT_CONFIG_FILE}: harness ${project.config.harness}, а CLI — ${HARNESS_VERSION}`,
    );
  }

  printOutdatedReport(report);

  const isUpToDate = isClean(report) && !isHarnessOutdated;

  if (!isUpToDate) console.log("Файлы агента устарели: запустите cyberzavod sync");

  return isUpToDate;
}

/**
 * Синхронизирует проект с harness: обновляет конфиг, собранный CLI и файлы агента.
 * @param {string} directory Каталог внутри проекта.
 * @param {SyncCommandOptions} options Перезаписать ли файлы человека.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @returns {Promise<void>} Готово, когда всё записано.
 * @throws {Error} Если проекта нет, CLI запущен из исходников или файлы агента не собрать.
 */
export async function syncProject(
  directory: string,
  options: SyncCommandOptions,
  installation: Installation,
): Promise<void> {
  const project = await requireProjectAt(directory);
  const tool = toolOf(installation);
  const config = await refreshedConfig(project.root, project.config);

  await writeProjectConfig(project.root, config);

  const isToolChanged = await updateToolFile(project.root, tool);
  const report = await syncClaude({
    projectDirectory: project.root,
    installation: claudeInstallationOf(installation),
    force: options.force,
  });

  printWrittenReport(withTool(report, isToolChanged));
}
