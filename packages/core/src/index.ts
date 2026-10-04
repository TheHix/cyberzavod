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
  NO_TALLY,
  type Tally,
  type Stage,
  type PromptEvent,
  type FactoryEvent,
  type Recording,
  type BuildStats,
} from "./recording.ts";
export { DEFAULT_LAYOUT, type FactoryLayout, type Point, type StationPlan } from "./layout.ts";
export {
  buildScript,
  DEFAULT_PACING,
  type Activity,
  type FactoryScript,
  type Mark,
  type Pacing,
  type PartMove,
  type PartPlace,
  type PartStatus,
  type PromptCue,
  type WorkerMove,
} from "./script.ts";
export {
  sceneAt,
  type PartFrame,
  type PromptFrame,
  type Scene,
  type WorkerFrame,
} from "./scene.ts";
