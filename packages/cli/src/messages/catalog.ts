// CLI message catalog by interface language.

import type { MessageCatalog } from "@cyberzavod/core";
import type { CliMessages } from "./cli-messages.ts";
import { en } from "./en.ts";
import { ru } from "./ru.ts";

/** CLI messages in each interface language. */
export const CLI_MESSAGES: MessageCatalog<CliMessages> = { en, ru };
