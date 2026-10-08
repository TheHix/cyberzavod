// Каталог сообщений CLI по языкам интерфейса.

import type { MessageCatalog } from "@cyberzavod/core";
import type { CliMessages } from "./cli-messages.ts";
import { en } from "./en.ts";
import { ru } from "./ru.ts";

/** Сообщения CLI на каждом языке интерфейса. */
export const CLI_MESSAGES: MessageCatalog<CliMessages> = { en, ru };
