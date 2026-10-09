// Адаптер Claude Code: файлы агента из harness, запись сессий в журнал проекта и публикация
// записей из черновика.

export { CLI_COMMAND, PACKAGE_NAME, pinnedCliCommand } from "./cli-command.ts";
export { draftSession, type DraftSessionOptions } from "./commands/draft.ts";
export { publishSessions, type PublishSessionsOptions } from "./commands/publish.ts";
export { ClaudeError } from "./errors.ts";
export { CLAUDE_MESSAGES } from "./messages/catalog.ts";
export type { ClaudeMessages } from "./messages/claude-messages.ts";
export {
  syncClaude,
  type ClaudeInstallation,
  type SyncOptions,
  type SyncReport,
} from "./generate/sync.ts";
export type { ClaudeTemplates } from "./generate/files.ts";
export { inspectClaudeHooks, type HooksReading } from "./generate/inspect.ts";
export { SETTINGS_FILE, type HooksInspection } from "./generate/settings.ts";
export {
  HOOK_NAMES,
  isHookName,
  runHook,
  type HookContext,
  type HookName,
  type HookOutcome,
} from "./hooks/index.ts";
