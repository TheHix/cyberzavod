// Каталог сообщений адаптера Claude Code по языкам интерфейса.

import type { MessageCatalog } from "@cyberzavod/core";
import type { ClaudeMessages } from "./claude-messages.ts";
import { en } from "./en.ts";
import { ru } from "./ru.ts";

/** Сообщения адаптера на каждом языке интерфейса. */
export const CLAUDE_MESSAGES: MessageCatalog<ClaudeMessages> = { en, ru };
