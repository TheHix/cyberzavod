// `cyberzavod status`: что за проект, по какому процессу он идёт и что лежит в журнале.

import path from "node:path";
import {
  DEFAULT_MODEL,
  type AgentConfig,
  type Harness,
  type JournalRecord,
  type RecordType,
  type StageGuide,
} from "@cyberzavod/core";
import { DirectoryRecordStore, RECORD_COLLECTIONS, workflowOf } from "@cyberzavod/storage";
import type { CommandError } from "../errors.ts";
import { HARNESS_VERSION, type Installation } from "../installation/installation.ts";
import { DEFAULT_AGENT } from "../wizard.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

const RECORD_TITLES: Readonly<Record<RecordType, string>> = {
  session: "сессии",
  decision: "решения",
  note: "заметки",
};

function performerOf(guide: StageGuide, agent: AgentConfig | undefined): string {
  if (guide.role === undefined) return "ведущий";

  return `${agent?.agent ?? DEFAULT_AGENT.agent} · ${agent?.model ?? DEFAULT_MODEL}`;
}

function processLines(project: ProjectAt, harness: Harness): string[] {
  const workflow = workflowOf(harness, project.config.workflow);
  const stages = workflow.stages.map((stage) => {
    const guide = harness.stages[stage];
    const performer = performerOf(guide, project.config.agents[stage]);

    return `  ${guide.title}: ${performer}`;
  });

  return [`Процесс: ${workflow.name}`, ...stages];
}

function countLine(records: JournalRecord[], type: RecordType): string {
  const count = records.filter((record) => record.type === type).length;

  return `${RECORD_TITLES[type]}: ${count}`;
}

function newerOf(newest: JournalRecord | undefined, record: JournalRecord): JournalRecord {
  return newest === undefined || record.timestamp > newest.timestamp ? record : newest;
}

function journalLines(project: ProjectAt, records: JournalRecord[]): string[] {
  const types = Object.keys(RECORD_COLLECTIONS) as RecordType[];
  const counts = types.map((type) => countLine(records, type));
  const latest = records.reduce<JournalRecord | undefined>(newerOf, undefined);
  const journalPath = path.relative(project.root, project.journal) || ".";
  const latestLines =
    latest === undefined ? [] : [`Последняя запись: ${latest.timestamp} (${latest.type})`];

  return [`Журнал: ${journalPath} — ${counts.join(", ")}`, ...latestLines];
}

function harnessLine(version: string): string {
  if (version === HARNESS_VERSION) return `Harness: ${version}`;

  return `Harness: ${version} (CLI — ${HARNESS_VERSION}, запустите cyberzavod sync)`;
}

/**
 * Печатает сводку проекта: конфиг, процесс, агенты этапов, проверки и журнал.
 * @param {string} directory Каталог внутри проекта.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @returns {Promise<void>} Готово, когда сводка напечатана.
 * @throws {CommandError} Если каталог не в проекте.
 */
export async function printStatus(directory: string, installation: Installation): Promise<void> {
  const project = await requireProjectAt(directory);
  const { config } = project;
  const checks = config.verification.commands;
  const checksLine = checks.length === 0 ? "не заданы" : checks.join("; ");
  const records = await new DirectoryRecordStore(project.journal).list();
  const lines = [
    `Проект: ${config.projectId} (${project.root})`,
    harnessLine(config.harness),
    ...processLines(project, installation.harness),
    `Проверки: ${checksLine}`,
    ...journalLines(project, records),
  ];

  for (const line of lines) console.log(line);
}
