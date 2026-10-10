// The agent adapters the CLI can drive, by name.

import type { CodexHomeSource } from "@cyberzavod/adapter-codex";
import type { AgentAdapter, AgentName } from "./agent-adapter.ts";
import { claudeAdapter } from "./claude.ts";
import { createCodexAdapter } from "./codex.ts";

/** Adapters by agent name; a name without an adapter does not compile. */
export type Adapters = Readonly<Record<AgentName, AgentAdapter>>;

/**
 * Builds the adapter of every agent the CLI can drive.
 * @param {CodexHomeSource} source Environment and home directory: where agents keep the human's
 *   own config.
 * @returns {Adapters} Adapters by agent name.
 */
export function createAdapters(source: CodexHomeSource): Adapters {
  return { claude: claudeAdapter, codex: createCodexAdapter(source) };
}
