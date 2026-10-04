// Запись сборок: хук Claude Code пишет сырой журнал, из него собирается черновик,
// после редактуры промптов черновик публикуется записью для цеха.

export {
  fromHookPayload,
  isSafeSessionId,
  parseRawLog,
  RawLogError,
  type RawEvent,
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
  type Draft,
  type DraftEvent,
  type DraftMessage,
  type DraftPrompt,
  type EditableDraftEvent,
} from "./draft.ts";
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
