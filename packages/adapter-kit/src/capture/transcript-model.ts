// What a draft takes from an agent's transcript. The model is the same for every agent; each
// adapter parses its own transcript format into these shapes.

/** A model reply in the transcript: when it ended and which model replied. */
export interface ModelReply {
  /** When the reply ended: the calls and prompts before this moment belong to it. */
  ts: number;
  model: string;
}

/** Tokens of one model message and the time it finished. */
export interface TokenUsage {
  ts: number;
  tokens: number;
}

/** Model text in the transcript: when it was said and what it says. */
export interface TranscriptText {
  ts: number;
  text: string;
}

/** A task the session gave a subagent: to a new run (`spawn`) or by a message (`message`). */
export type AgentAssignment = { ts: number; text: string } & (
  { via: "spawn"; agentType: string; agentId?: string } | { via: "message"; agentId: string }
);

/** A subagent run's report: what it handed back to the session, when, and who it was. */
export interface AgentReport {
  ts: number;
  agentId: string;
  text: string;
}
