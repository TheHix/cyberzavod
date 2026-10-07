// Проигрыватель цеха: запись сессии → сценарий → кадр в любой момент. Нужен только витрине
// (сайту); инструмент разработки о нём не знает. Чистый TypeScript, как ядро.

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
