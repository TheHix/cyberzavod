// Claude Code adapter texts for the human: what the generator cannot do. The texts of the stop and
// capture hooks, drafting and publishing recordings are shared with the other agents (see the
// adapter kit). A value is a string or a function; with two or more parameters, one object with
// named fields. The sets live in `en.ts` and `ru.ts`; the CLI picks the language.

/** Adapter error texts: what the human fixes themselves. */
export interface ClaudeErrorMessages {
  unsupportedAgent(params: { stage: string; requested: string; supported: string }): string;
}

/** All texts of the Claude Code adapter. */
export interface ClaudeMessages {
  errors: ClaudeErrorMessages;
}
