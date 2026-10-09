// Claude Code adapter message catalog by interface language.

import type { MessageCatalog } from "@cyberzavod/core";
import type { ClaudeMessages } from "./claude-messages.ts";
import { en } from "./en.ts";
import { ru } from "./ru.ts";

/** Adapter messages in each interface language. */
export const CLAUDE_MESSAGES: MessageCatalog<ClaudeMessages> = { en, ru };
