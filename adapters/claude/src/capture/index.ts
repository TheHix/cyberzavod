// Захват сессий: хук Claude Code пишет сырой журнал, из него собирается черновик,
// после редактуры промптов черновик публикуется записью для цеха.

export {
  fromHookPayload,
  isSafeSessionId,
  markAfterStopGate,
  parseRawLog,
  RawLogError,
  stampProject,
  type PromptRawEvent,
  type RawEvent,
  type SessionStartEvent,
} from "./raw-event.ts";
export {
  directoriesOutsideProjects,
  isHumanPrompt,
  routeMessages,
  runTranscriptPaths,
  sessionTranscriptPath,
  sessionTranscriptPaths,
  stationTranscriptPaths,
  toDraft,
  toolDirectories,
  type DraftMeta,
} from "./to-draft.ts";
export {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  orphanedRuns,
  parseDraft,
  publishBuild,
  publishDraft,
  reroutedMessages,
  unfilledHeader,
  type Draft,
  type DraftBuild,
  type DraftCheck,
  type DraftEvent,
  type DraftIntervention,
  type DraftMessage,
  type DraftPrompt,
  type DraftRun,
  type EditableDraftEvent,
  type MessageSource,
} from "./draft.ts";
export {
  buildTimeline,
  eventBuilds,
  IDLE_GAP_MS,
  projectsWithoutBuild,
  unassignedRuns,
} from "./builds.ts";
export { findLeaks } from "./leaks.ts";
export {
  agentAssignments,
  agentReports,
  assistantTexts,
  countTokens,
  modelReplies,
  tokenUsages,
  type AgentAssignment,
  type AgentReport,
  type ModelReply,
  type TokenUsage,
  type TranscriptText,
} from "./transcript.ts";
