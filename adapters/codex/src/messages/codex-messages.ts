// Codex adapter texts: the reason the `.env` guard gives the agent, and errors that the human fixes
// themselves. A value is a string or a function; with two or more parameters, one object with named
// fields. The sets live in `en.ts` and `ru.ts`; the CLI picks the language.

/** Adapter error texts: what the human fixes themselves. */
export interface CodexErrorMessages {
  unsupportedAgent(params: { stage: string; requested: string; supported: string }): string;
  configNotParsed(params: { file: string; reason: string }): string;
  configLayoutUnsupported(params: { file: string; lines: string }): string;
  configEditRejected(file: string): string;
}

/** Texts of the `.env` guard: the reason Codex shows the agent when a tool call is denied. */
export interface GuardMessages {
  secretFile(file: string): string;
  rawLog(file: string): string;
}

/** All texts of the Codex adapter. */
export interface CodexMessages {
  guard: GuardMessages;
  errors: CodexErrorMessages;
}
