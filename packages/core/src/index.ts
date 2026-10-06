// Ядро завода: чистый TypeScript без зависимостей от фреймворков и браузера.
// Интерфейс и рендер цеха только читают то, что экспортируется отсюда.

export {
  STAGES,
  RecordingError,
  parseFactoryEvent,
  parseRecording,
  succeeded,
  summarize,
  tally,
  briefOf,
  isSpeaker,
  isRecordingId,
  isFactoryVersion,
  FOREMAN,
  NO_TALLY,
  type Tally,
  type Stage,
  type Speaker,
  type PromptEvent,
  type MessageEvent,
  type BriefMessageEvent,
  type BriefFactoryEvent,
  type BriefRecording,
  type FactoryEvent,
  type Recording,
  type BuildStats,
} from "./recording.ts";
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
  type StationPlan,
} from "./layout.ts";
export {
  buildScript,
  DEFAULT_PACING,
  type Activity,
  type FactoryScript,
  type ForemanActivity,
  type ForemanMove,
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
  type MessageFrame,
  type PartFrame,
  type PromptFrame,
  type Scene,
  type WorkerFrame,
} from "./scene.ts";
