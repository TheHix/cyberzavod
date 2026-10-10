// What a Codex hook is called with.

import type { HookContext } from "@cyberzavod/adapter-kit";
import type { GuardMessages } from "../messages/codex-messages.ts";

/**
 * Hook call of Codex: the call shared with the other agents plus the texts of the `.env` guard.
 * `projectDirectory` is any directory inside the project, for example the session directory from
 * the payload: Codex gives hooks no variable with the project root.
 */
export interface CodexHookContext extends HookContext {
  guardMessages: GuardMessages;
}
