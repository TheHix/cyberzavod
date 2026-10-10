// Texts the adapters share, for the human and the agent. A value is a string or a function; with
// two or more parameters, one object with named fields. The sets live in `en.ts` and `ru.ts`; the
// CLI picks the language.

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
  errors: KitErrorMessages;
}
