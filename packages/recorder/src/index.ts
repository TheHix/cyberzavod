// Запись сборок: хук Claude Code пишет сырой журнал, из него собирается черновик,
// после редактуры промптов черновик публикуется записью для цеха.

export {
  fromHookPayload,
  isSafeSessionId,
  parseRawLog,
  RawLogError,
  stampProject,
  type RawEvent,
  type SessionStartEvent,
} from "./raw-event.ts";
export {
  isHumanPrompt,
  sessionTranscriptPath,
  stationTranscriptPaths,
  toDraft,
  transcriptPaths,
  type DraftMeta,
} from "./to-draft.ts";
export {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  parseDraft,
  publishDraft,
  unfilledHeader,
  type Draft,
  type DraftEvent,
  type DraftMessage,
  type DraftPrompt,
  type EditableDraftEvent,
  type MessageSource,
} from "./draft.ts";
export { parseProjectConfig, ProjectConfigError, type ProjectConfig } from "./project.ts";
export { findLeaks } from "./leaks.ts";
export {
  agentAssignments,
  agentReports,
  assistantTexts,
  countTokens,
  modelReplies,
  type AgentAssignment,
  type AgentReport,
  type ModelReply,
  type TranscriptText,
} from "./transcript.ts";
