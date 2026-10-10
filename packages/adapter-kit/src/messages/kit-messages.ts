// Texts the adapters share, for the human and the agent: the stop hook (the agent reads its message
// as a task), the capture hook and errors of the shared code. A value is a string or a function;
// with two or more parameters, one object with named fields. The sets live in `en.ts` and `ru.ts`;
// the CLI picks the language.

/** Stop hook texts: the agent receives them as the hook's message. */
export interface StopMessages {
  configUnreadable(params: { file: string; reason: string }): string;
  gitUnavailable(reason: string): string;
  counterNotSaved(file: string): string;
  checksFailing(params: {
    command: string;
    attempt: number;
    maxAttempts: number;
    output: string;
  }): string;
  humanCalled(maxAttempts: number): string;
  markerNotSaved: string;
}

/** Session capture hook texts. */
export interface RecordMessages {
  sessionNotRecorded(reason: string): string;
  markerNotClaimed(params: { file: string; reason: string }): string;
}

/** Texts of errors that come from generating agent files, the same for every agent. */
export interface KitErrorMessages {
  fileConflicts(files: string): string;
  settingsNotObject(file: string): string;
  settingsNotParsed(params: { file: string; reason: string }): string;
  manifestNotParsed(params: { file: string; reason: string }): string;
  unknownPlaceholder(placeholder: string): string;
  projectNotFound(directory: string): string;
}

/** All texts shared by the adapters. */
export interface KitMessages {
  stop: StopMessages;
  record: RecordMessages;
  errors: KitErrorMessages;
}
