// The agent adapters the CLI can drive, by name.

import type { AgentAdapter, AgentName } from "./agent-adapter.ts";
import { claudeAdapter } from "./claude.ts";

/** Adapters by agent name; a name without an adapter does not compile. */
export type Adapters = Readonly<Record<AgentName, AgentAdapter>>;

/**
 * Builds the adapter of every agent the CLI can drive.
 * @returns {Adapters} Adapters by agent name.
 */
export function createAdapters(): Adapters {
  return { claude: claudeAdapter };
}
