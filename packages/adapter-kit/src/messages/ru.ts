// Russian texts the adapters share.

import { CLI_COMMAND } from "../cli-command.ts";
import type { KitMessages } from "./kit-messages.ts";

/** Shared adapter texts in Russian. */
export const ru: KitMessages = {
  errors: {
    fileConflicts: (files) =>
      `ничего не изменено: эти файлы ваши (написаны не генератором или исправлены руками после генерации): ${files}. Перенесите правки в AGENTS.md и удалите файлы или перезапишите их командой ${CLI_COMMAND} sync --force`,
    settingsNotObject: (file) => `${file} не разобран: настройки должны быть объектом`,
    settingsNotParsed: ({ file, reason }) => `${file} не разобран: ${reason}`,
    manifestNotParsed: ({ file, reason }) =>
      `${file} не разобран: ${reason}. Верните его из git или удалите и запустите ${CLI_COMMAND} sync`,
    unknownPlaceholder: (placeholder) => `в шаблоне неизвестная подстановка ${placeholder}`,
    projectNotFound: (directory) =>
      `${directory} не в проекте Cyberzavod: сначала ${CLI_COMMAND} init`,
  },
};
