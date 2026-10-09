// Тексты адаптера Claude Code для человека и агента: хук остановки (его stderr агент читает как
// задание), хук записи, черновик и публикация записей, ошибки. Значение — строка или функция;
// при двух и более параметрах — один объект с именованными полями. Наборы лежат в `en.ts`
// и `ru.ts`, язык выбирает CLI.

import type { InterventionReason } from "@cyberzavod/core";
import type { HeaderField } from "../capture/draft.ts";
import type { LeakKind } from "../capture/leaks.ts";

/** Тексты хука остановки: агент получает их как сообщение хука. */
export interface StopMessages {
  configUnreadable(params: { file: string; reason: string }): string;
  gitUnavailable(reason: string): string;
  counterNotSaved(file: string): string;
  checksFailing(params: {
    command: string;
    attempt: number;
    maxAttempts: number;
    output: string;
  }): string;
  humanCalled(maxAttempts: number): string;
  markerNotSaved: string;
}

/** Тексты хука записи сессии. */
export interface RecordMessages {
  sessionNotRecorded(reason: string): string;
  markerNotClaimed(params: { file: string; reason: string }): string;
}

/** Тексты команды `draft`. */
export interface DraftMessages {
  configNotRead(reason: string): string;
  transcriptNotRead(params: { file: string; reason: string }): string;
  transcriptsMissing(count: number): string;
  sessionTranscriptNotRead(reason: string): string;
  stationTranscriptsMissing(count: number): string;
  /** Подпись вмешательства в предупреждениях и списке ожидающих редактуры. */
  intervention(params: { reason: InterventionReason; text: string }): string;
  editNotCarried(title: string): string;
  assignmentNotFound: string;
  draftFile(file: string): string;
  counts(params: { prompts: number; messages: number; interventions: number }): string;
  build(params: {
    id: string;
    project: string;
    harness: string;
    workflow: string;
    runs: number;
    events: number;
  }): string;
  unfilledHeader(params: { buildId: string; fields: string }): string;
  projectWithoutBuild(project: string): string;
  directoryOutsideProject(directory: string): string;
  waiting(count: number): string;
  unassignedRuns(count: number): string;
  unassignedRun(params: { agent: string; run: string; clock: string; line: string }): string;
  orphanedRun(run: string): string;
  reroutedMessage(params: { line: string; from: string; to: string }): string;
}

/** Тексты команды `publish`. */
export interface PublishMessages {
  published(file: string): string;
  notReady(params: { file: string; problems: string }): string;
  buildProblem(params: { buildId: string; reason: string }): string;
}

/** Тексты ошибок адаптера: то, что человек исправляет сам. */
export interface ClaudeErrorMessages {
  unsupportedAgent(params: { stage: string; requested: string; supported: string }): string;
  fileConflicts(files: string): string;
  settingsNotObject(file: string): string;
  settingsNotParsed(params: { file: string; reason: string }): string;
  manifestNotParsed(params: { file: string; reason: string }): string;
  unknownPlaceholder(placeholder: string): string;
  projectNotFound(directory: string): string;
  noDrafts: string;
  noRawLogs(directory: string): string;
  earlierDraftNotParsed(file: string): string;
  noBuild(buildId: string): string;
  buildHasNoEvents(buildId: string): string;
  leaksFound(params: { buildId: string; leaks: string }): string;
  leakIn(params: { kind: string; text: string }): string;
}

/** Все тексты адаптера Claude Code. */
export interface ClaudeMessages {
  stop: StopMessages;
  record: RecordMessages;
  draft: DraftMessages;
  publish: PublishMessages;
  errors: ClaudeErrorMessages;
  /** Названия видов того, что нельзя публиковать: для сообщения об утечке. */
  leakKinds: Readonly<Record<LeakKind, string>>;
  /** Названия полей шапки сборки: что редактор ещё не заполнил. */
  headerFields: Readonly<Record<HeaderField, string>>;
}
