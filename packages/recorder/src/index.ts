// Запись сборок: хук Claude Code пишет сырой журнал, из него собирается черновик,
// после редактуры промптов черновик публикуется записью для цеха.

export {
  fromHookPayload,
  isSafeSessionId,
  parseRawLog,
  RawLogError,
  type RawEvent,
} from "./raw-event.ts";
export { isHumanPrompt, toDraft, transcriptPaths, type DraftMeta } from "./to-draft.ts";
export {
  carryOverEdits,
  DraftError,
  orphanedEdits,
  parseDraft,
  publishDraft,
  type Draft,
  type DraftEvent,
  type DraftPrompt,
} from "./draft.ts";
export { findLeaks } from "./leaks.ts";
export { countTokens } from "./transcript.ts";
