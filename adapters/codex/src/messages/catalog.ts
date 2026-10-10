// Codex adapter message catalog by interface language.

import type { MessageCatalog } from "@cyberzavod/core";
import type { CodexMessages } from "./codex-messages.ts";
import { en } from "./en.ts";
import { ru } from "./ru.ts";

/** Adapter messages in each interface language. */
export const CODEX_MESSAGES: MessageCatalog<CodexMessages> = { en, ru };
