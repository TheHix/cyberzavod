// Ядро Cyberzavod: доменная модель (этапы, процесс, агенты, конфиг проекта, harness, записи
// журнала). Чистый TypeScript без зависимостей от фреймворков, браузера и Node.

export {
  HarnessError,
  parseHarness,
  parseStageGuide,
  STAGE_ACCESS,
  type Harness,
  type HarnessFiles,
  type Principle,
  type StageAccess,
  type StageGuide,
  type StageRole,
} from "./harness.ts";
export {
  STAGES,
  WorkflowError,
  isStage,
  parseWorkflow,
  type Stage,
  type Workflow,
} from "./stage.ts";
export { AgentConfigError, DEFAULT_MODEL, parseAgentConfig, type AgentConfig } from "./agent.ts";
export {
  ProjectConfigError,
  parseProjectConfig,
  type ProjectConfig,
  type StackInfo,
  type VerificationConfig,
} from "./project-config.ts";
export {
  RECORD_VERSION,
  INTERVENTION_REASONS,
  RecordError,
  parseSessionEvent,
  parseRecord,
  succeeded,
  summarize,
  tally,
  briefOf,
  briefIntervention,
  briefMessage,
  isSpeaker,
  isRecordId,
  isHarnessVersion,
  isLanguageCode,
  LEGACY_SESSION_LANGUAGE,
  FOREMAN,
  NO_TALLY,
  type Tally,
  type Speaker,
  type PromptEvent,
  type MessageEvent,
  type InterventionEvent,
  type InterventionReason,
  type BriefMessageEvent,
  type BriefInterventionEvent,
  type BriefSessionEvent,
  type BriefSessionRecord,
  type SessionEvent,
  type SessionData,
  type SessionRecord,
  type DecisionRecord,
  type NoteRecord,
  type JournalRecord,
  type RecordHeader,
  type RecordSource,
  type RecordType,
  type BuildStats,
} from "./record.ts";
export type { RecordStore } from "./store.ts";
export { ProjectError, parseProject, type Project } from "./project.ts";
export {
  DEFAULT_INTERFACE_LANGUAGE,
  INTERFACE_LANGUAGES,
  isInterfaceLanguage,
  type InterfaceLanguage,
  type LocalizedText,
  type MessageCatalog,
} from "./interface-language.ts";
