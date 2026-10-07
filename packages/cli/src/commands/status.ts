// `cyberzavod status`: что за проект, по какому процессу он идёт и что лежит в журнале.

import path from "node:path";
import { DEFAULT_MODEL, type JournalRecord, type RecordType } from "@cyberzavod/core";
import {
  DirectoryRecordStore,
  loadHarness,
  RECORD_COLLECTIONS,
  workflowOf,
} from "@cyberzavod/storage";
import { HARNESS_DIRECTORY, HARNESS_VERSION } from "../install.ts";
import type { CommandError } from "../errors.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

const RECORD_TITLES: Readonly<Record<RecordType, string>> = {
  session: "сессии",
  decision: "решения",
  note: "заметки",
};

async function processLines(project: ProjectAt): Promise<string[]> {
  const harness = await loadHarness(HARNESS_DIRECTORY);
  const workflow = workflowOf(harness, project.config.workflow);
  const stages = workflow.stages.map((stage) => {
    const guide = harness.stages[stage];
    const agent = project.config.agents[stage];
    const who =
      guide.role === undefined
        ? "ведущий"
        : `${agent?.agent ?? "claude"} · ${agent?.model ?? DEFAULT_MODEL}`;
    return `  ${guide.title}: ${who}`;
  });
  return [`Процесс: ${workflow.name}`, ...stages];
}

function journalLines(project: ProjectAt, records: JournalRecord[]): string[] {
  const counts = (Object.keys(RECORD_COLLECTIONS) as RecordType[]).map(
    (type) => `${RECORD_TITLES[type]}: ${records.filter((record) => record.type === type).length}`,
  );
  const latest = records.reduce<JournalRecord | undefined>(
    (newest, record) =>
      newest === undefined || record.timestamp > newest.timestamp ? record : newest,
    undefined,
  );
  return [
    `Журнал: ${path.relative(project.root, project.journal) || "."} — ${counts.join(", ")}`,
    ...(latest === undefined ? [] : [`Последняя запись: ${latest.timestamp} (${latest.type})`]),
  ];
}

/**
 * Печатает сводку проекта: конфиг, процесс, агенты этапов, проверки и журнал.
 * @param {string} directory Каталог внутри проекта.
 * @returns {Promise<void>} Готово, когда сводка напечатана.
 * @throws {CommandError} Если каталог не в проекте.
 */
export async function printStatus(directory: string): Promise<void> {
  const project = await requireProjectAt(directory);
  const { config } = project;
  const harness =
    config.harness === HARNESS_VERSION
      ? config.harness
      : `${config.harness} (CLI — ${HARNESS_VERSION}, запустите cyberzavod sync)`;
  const checks = config.verification.commands;
  const records = await new DirectoryRecordStore(project.journal).list();
  const lines = [
    `Проект: ${config.projectId} (${project.root})`,
    `Harness: ${harness}`,
    ...(await processLines(project)),
    `Проверки: ${checks.length === 0 ? "не заданы" : checks.join("; ")}`,
    ...journalLines(project, records),
  ];
  for (const line of lines) console.log(line);
}
