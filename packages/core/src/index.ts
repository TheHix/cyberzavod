// Ядро Cyberzavod: доменная модель (этапы, процесс, агенты, конфиг проекта, записи журнала)
// и проигрыватель цеха. Чистый TypeScript без зависимостей от фреймворков, браузера и Node.

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
  isSpeaker,
  isRecordId,
  isHarnessVersion,
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
export type { Aisle } from "./aisle.ts";
export { carryTime, ScriptMismatchError } from "./carry-time.ts";
export {
  FACTORY_LAYOUTS,
  PORTRAIT_LAYOUT,
  WIDE_LAYOUT,
  layoutFor,
  type FactoryLayout,
  type ForemanPlan,
  type Point,
  type Size,
  type StationPlan,
} from "./layout.ts";
export {
  buildScript,
  DEFAULT_PACING,
  type Activity,
  type FactoryScript,
  type ForemanActivity,
  type ForemanMove,
  type InterventionCue,
  type Mark,
  type MessageCue,
  type Pacing,
  type PartMove,
  type PartPlace,
  type PartStatus,
  type PromptCue,
  type WorkerMove,
} from "./script.ts";
export {
  sceneAt,
  type ForemanFrame,
  type InterventionFrame,
  type MessageFrame,
  type PartFrame,
  type PromptFrame,
  type Scene,
  type WorkerFrame,
} from "./scene.ts";
