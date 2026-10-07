// Адаптер Claude Code: файлы агента из harness, запись сессий в журнал проекта и публикация
// записей из черновика.

export { draftSession, type DraftSessionOptions } from "./commands/draft.ts";
export { publishSessions, type PublishSessionsOptions } from "./commands/publish.ts";
export { GenerateError } from "./generate/claude.ts";
export {
  syncClaude,
  type ClaudeInstallation,
  type SyncOptions,
  type SyncReport,
} from "./generate/sync.ts";
export type { ClaudeTemplates } from "./generate/files.ts";
export {
  HOOK_NAMES,
  isHookName,
  runHook,
  type HookContext,
  type HookName,
  type HookOutcome,
} from "./hooks/index.ts";
