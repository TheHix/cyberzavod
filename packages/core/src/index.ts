// Ядро завода: чистый TypeScript без зависимостей от фреймворков и браузера.
// Интерфейс и рендер цеха только читают то, что экспортируется отсюда.

export {
  STAGES,
  RecordingError,
  parseRecording,
  summarize,
  type Stage,
  type FactoryEvent,
  type Recording,
  type BuildStats,
} from "./recording.ts";
