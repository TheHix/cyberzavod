// Claude Code adapter texts for the human and the agent: the stop hook (the agent reads its stderr
// as a task), the capture hook, drafting and publishing recordings, errors. A value is a string or
// a function; with two or more parameters, one object with named fields. The sets live in `en.ts`
// and `ru.ts`; the CLI picks the language.

import type { InterventionReason } from "@cyberzavod/core";
import type { HeaderField } from "../capture/draft.ts";
import type { LeakKind } from "../capture/leaks.ts";

/** Stop hook texts: the agent receives them as the hook's message. */
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

/** Session capture hook texts. */
export interface RecordMessages {
  sessionNotRecorded(reason: string): string;
  markerNotClaimed(params: { file: string; reason: string }): string;
}

/** Texts of the `draft` command. */
export interface DraftMessages {
  configNotRead(reason: string): string;
  transcriptNotRead(params: { file: string; reason: string }): string;
  transcriptsMissing(count: number): string;
  sessionTranscriptNotRead(reason: string): string;
  stationTranscriptsMissing(count: number): string;
  /** Intervention label in warnings and in the list awaiting editing. */
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

/** Texts of the `publish` command. */
export interface PublishMessages {
  published(file: string): string;
  notReady(params: { file: string; problems: string }): string;
  buildProblem(params: { buildId: string; reason: string }): string;
}

/** Adapter error texts: what the human fixes themselves. */
export interface ClaudeErrorMessages {
  unsupportedAgent(params: { stage: string; requested: string; supported: string }): string;
  noDrafts: string;
  noRawLogs(directory: string): string;
  earlierDraftNotParsed(file: string): string;
  noBuild(buildId: string): string;
  buildHasNoEvents(buildId: string): string;
  leaksFound(params: { buildId: string; leaks: string }): string;
  leakIn(params: { kind: string; text: string }): string;
}

/** All texts of the Claude Code adapter. */
export interface ClaudeMessages {
  stop: StopMessages;
  record: RecordMessages;
  draft: DraftMessages;
  publish: PublishMessages;
  errors: ClaudeErrorMessages;
  /** Names of the kinds of content that must not be published: for the leak message. */
  leakKinds: Readonly<Record<LeakKind, string>>;
  /** Names of the build header fields: what the editor has not filled in yet. */
  headerFields: Readonly<Record<HeaderField, string>>;
}
