// Message catalog the adapters share, by interface language.

import type { MessageCatalog } from "@cyberzavod/core";
import { en } from "./en.ts";
import type { KitMessages } from "./kit-messages.ts";
import { ru } from "./ru.ts";

/** Shared adapter messages in each interface language. */
export const KIT_MESSAGES: MessageCatalog<KitMessages> = { en, ru };
