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
import type { CliMessages } from "../messages/cli-messages.ts";
import { DEFAULT_AGENT } from "../initial-config.ts";
import { requireProjectAt, type ProjectAt } from "./project.ts";

function performerOf(
  guide: StageGuide,
  agent: AgentConfig | undefined,
  messages: CliMessages,
): string {
  if (guide.role === undefined) return messages.status.foreman;

  return `${agent?.agent ?? DEFAULT_AGENT.agent} · ${agent?.model ?? DEFAULT_MODEL}`;
}

function processLines(project: ProjectAt, harness: Harness, messages: CliMessages): string[] {
  const workflow = workflowOf(harness, project.config.workflow);
  const stages = workflow.stages.map((stage) => {
    const guide = harness.stages[stage];
    const performer = performerOf(guide, project.config.agents[stage], messages);

    return `  ${guide.title}: ${performer}`;
  });

  return [messages.status.workflow(workflow.name), ...stages];
}

function countLine(records: JournalRecord[], type: RecordType, messages: CliMessages): string {
  const count = records.filter((record) => record.type === type).length;

  return `${messages.status.recordTypes[type]}: ${count}`;
}

function newerOf(newest: JournalRecord | undefined, record: JournalRecord): JournalRecord {
  return newest === undefined || record.timestamp > newest.timestamp ? record : newest;
}

function journalLines(
  project: ProjectAt,
  records: JournalRecord[],
  messages: CliMessages,
): string[] {
  const types = Object.keys(RECORD_COLLECTIONS) as RecordType[];
  const counts = types.map((type) => countLine(records, type, messages));
  const latest = records.reduce<JournalRecord | undefined>(newerOf, undefined);
  const journalPath = path.relative(project.root, project.journal) || ".";
  const latestLines =
    latest === undefined
      ? []
      : [messages.status.latestRecord({ timestamp: latest.timestamp, type: latest.type })];
  const journalLine = messages.status.journal({ path: journalPath, counts: counts.join(", ") });

  return [journalLine, ...latestLines];
}

function harnessLine(version: string, messages: CliMessages): string {
  if (version === HARNESS_VERSION) return messages.status.harness(version);

  return messages.status.harnessOutdated({ version, cliVersion: HARNESS_VERSION });
}

/**
 * Печатает сводку проекта: конфиг, процесс, агенты этапов, проверки и журнал.
 * @param {string} directory Каталог внутри проекта.
 * @param {Installation} installation Запущенная версия Cyberzavod.
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {Promise<void>} Готово, когда сводка напечатана.
 * @throws {CommandError} Если каталог не в проекте.
 */
export async function printStatus(
  directory: string,
  installation: Installation,
  messages: CliMessages,
): Promise<void> {
  const project = await requireProjectAt(directory);
  const { config } = project;
  const checks = config.verification.commands;
  const checksList = checks.length === 0 ? messages.status.checksNone : checks.join("; ");
  const records = await new DirectoryRecordStore(project.journal).list();
  const lines = [
    messages.status.project({ id: config.projectId, root: project.root }),
    harnessLine(config.harness, messages),
    ...processLines(project, installation.harness, messages),
    messages.status.checks(checksList),
    ...journalLines(project, records, messages),
  ];

  for (const line of lines) console.log(line);
}
