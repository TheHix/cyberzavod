// Hook names for the help line of `hook`: the names of every agent, each once.

import { HOOK_NAMES } from "@cyberzavod/adapter-claude";
import { CODEX_HOOK_NAMES } from "@cyberzavod/adapter-codex";
import type { AgentName } from "../agents/agent-adapter.ts";

/** Hook names by agent; an agent without an entry does not compile. */
export const HOOK_NAMES_BY_AGENT: Readonly<Record<AgentName, readonly string[]>> = {
  claude: HOOK_NAMES,
  codex: CODEX_HOOK_NAMES,
};

/** Names of the hooks of all the agents the CLI can drive, each once. */
export const ALL_HOOK_NAMES: readonly string[] = [
  ...new Set<string>(Object.values(HOOK_NAMES_BY_AGENT).flat()),
];
