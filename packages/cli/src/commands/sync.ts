// `cyberzavod sync`: заново смотрит на стек, ставит в конфиг текущую версию harness и приводит
// файлы агента к harness. `--check` только сравнивает — так проверки проекта ловят устаревшие
// файлы.

import { syncClaude, type SyncReport } from "@cyberzavod/adapter-claude";
import type { ProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { detectProject } from "../detect.ts";
import { HARNESS_VERSION } from "../install.ts";
import { requireProjectAt } from "./project.ts";

/** Режим синхронизации. */
export interface SyncCommandOptions {
  check: boolean;
  force: boolean;
}

async function refreshedConfig(root: string, config: ProjectConfig): Promise<ProjectConfig> {
  const detected = await detectProject(root);
  return {
    ...config,
    harness: HARNESS_VERSION,
    stack: {
      languages: detected.languages,
      frameworks: detected.frameworks,
      ...(detected.packageManager === undefined ? {} : { packageManager: detected.packageManager }),
    },
  };
}

function printReport(report: SyncReport, check: boolean): void {
  const groups = [
    [check ? "устарели" : "записаны", report.changed],
    [check ? "лишние" : "удалены", report.removed],
    ["написаны человеком", report.conflicts],
  ] as const;
  for (const [title, files] of groups) {
    if (files.length > 0) console.log(`${title}:\n${files.map((file) => `  ${file}`).join("\n")}`);
  }
}

function isClean(report: SyncReport): boolean {
  return report.changed.length + report.removed.length + report.conflicts.length === 0;
}

/**
 * Синхронизирует проект с harness или проверяет, что синхронизировать нечего.
 * @param {string} directory Каталог внутри проекта.
 * @param {SyncCommandOptions} options Только проверить или записать; перезаписать ли файлы человека.
 * @returns {Promise<boolean>} true, если всё записано или, при проверке, всё актуально.
 * @throws {Error} Если проекта нет или файлы агента не собрать.
 */
export async function syncProject(
  directory: string,
  options: SyncCommandOptions,
): Promise<boolean> {
  const project = await requireProjectAt(directory);
  if (options.check) {
    const report = await syncClaude({ projectDirectory: project.root, check: true });
    const outdated = project.config.harness !== HARNESS_VERSION;
    if (outdated) {
      console.log(
        `${PROJECT_CONFIG_FILE}: harness ${project.config.harness}, а CLI — ${HARNESS_VERSION}`,
      );
    }
    printReport(report, true);
    const clean = isClean(report) && !outdated;
    if (!clean) console.log("Файлы агента устарели: запустите cyberzavod sync");
    return clean;
  }
  await writeProjectConfig(project.root, await refreshedConfig(project.root, project.config));
  printReport(await syncClaude({ projectDirectory: project.root, force: options.force }), false);
  return true;
}
