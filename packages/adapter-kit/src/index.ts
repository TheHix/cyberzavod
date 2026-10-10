// Shared code of the agent adapters: ownership of generated files, hooks files, the manifest,
// templates and the texts both agents use. It knows no agent by name; each adapter builds on it.

export { CLI_COMMAND, PACKAGE_NAME, pinnedCliCommand } from "./cli-command.ts";
export { KitError } from "./errors.ts";
export {
  MAX_COMMAND_LENGTH,
  parseRawLog,
  RawLogError,
  subagentNameOf,
  UNKNOWN_NAME,
  verdictOf,
  withOptional,
  type RawEvent,
} from "./capture/raw-event.ts";
export { isHumanPrompt } from "./capture/service-messages.ts";
export { SILENT_EXIT, type HookContext, type HookOutcome } from "./hooks/hook.ts";
export { recordEvent, RecordHookError, type RawEventSource } from "./hooks/record.ts";
export { hookStatePath } from "./hooks/state.ts";
export { gateStop } from "./hooks/stop-gate.ts";
export { startTurn } from "./hooks/turn-start.ts";
export { isObject, stringField } from "./object.ts";
export {
  applyDisconnect,
  isEmptySettings,
  plannedDisconnectFiles,
  settingsOutcomeOf,
  settingsText,
  withoutAdapterHooks,
  type DisconnectOptions,
  type DisconnectPlan,
  type FilesDisconnectSource,
  type SettingsDisconnect,
  type SettingsOutcome,
} from "./generate/disconnect-plan.ts";
export {
  applySyncPlan,
  directoriesWith,
  fileAt,
  filesOnDisk,
  generatedCandidates,
  ownershipOf,
  planSyncFiles,
  readOptional,
  relativeTo,
  removeEmptyParents,
  removeGeneratedFiles,
  requireWritable,
  type CandidateSource,
  type FileOnDisk,
  type Ownership,
  type PlanSource,
  type SyncPlan,
  type SyncReport,
} from "./generate/file-plan.ts";
export {
  hookCommand,
  hookNameOf,
  groupsOf,
  inspectHooks,
  isOwnHandler,
  mergedHooks,
  parseSettings,
  SettingsError,
  SKIP_ON_FAILURE,
  STOP_GATE_TIMEOUT_SECONDS,
  STOP_STATUS_MESSAGE,
  stopFailureCommand,
  TURN_START_TIMEOUT_SECONDS,
  unparsedSettings,
  withoutOwnHooks,
  type AdapterHooks,
  type HookCommandSource,
  type HookGroup,
  type HookHandler,
  type HooksComparison,
  type HooksInspection,
  type Settings,
} from "./generate/hook-config.ts";
export {
  contentHash,
  EMPTY_MANIFEST,
  MANIFEST_FILE,
  manifestText,
  parseManifest,
  type Manifest,
} from "./generate/manifest.ts";
export {
  GENERATED_MARK,
  HASH_GENERATED_COMMENT,
  isGenerated,
  LEGACY_GENERATED_MARK,
  MARKDOWN_GENERATED_COMMENT,
  type GeneratedFile,
} from "./generate/marks.ts";
export { renderTemplate, templateValues, type TemplateSource } from "./generate/template.ts";
export {
  ownStageSections,
  stageGuidesOf,
  stageTable,
  workingRulesParagraphs,
  type WorkingRulesSource,
} from "./generate/workflow-text.ts";
export { KIT_MESSAGES } from "./messages/catalog.ts";
export type {
  KitErrorMessages,
  KitMessages,
  RecordMessages,
  StopMessages,
} from "./messages/kit-messages.ts";
export {
  captureDirectories,
  locatedFromPlanned,
  locateProject,
  requireProject,
  type CaptureDirectories,
  type LocatedProject,
  type PlannedProject,
} from "./paths.ts";
