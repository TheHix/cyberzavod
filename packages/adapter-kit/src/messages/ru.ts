// Russian texts the adapters share.

import { CLI_COMMAND } from "../cli-command.ts";
import type { KitMessages } from "./kit-messages.ts";

/** Shared adapter texts in Russian. */
export const ru: KitMessages = {
  stop: {
    configUnreadable: ({ file, reason }) =>
      `Конфиг ${file} не читается — проверки пропущены, агент отпущен. ${reason}`,
    gitUnavailable: (reason) =>
      `Хук остановки не запустил git — проверки пропущены, агент отпущен. ${reason}`,
    counterNotSaved: (file) =>
      `Хук остановки не смог записать счётчик попыток (${file}) — проверки красные, агент отпущен без повторов.`,
    checksFailing: ({ command, attempt, maxAttempts, output }) =>
      `${command} не проходит — закончить работу нельзя (попытка ${attempt} из ${maxAttempts}). Исправь:\n${output}\n`,
    humanCalled: (maxAttempts) =>
      `Проверки красные после ${maxAttempts} попыток исправить — агент остановлен, нужен человек.`,
    markerNotSaved: "Отметка для записи не сохранена.",
  },
  record: {
    sessionNotRecorded: (reason) => `сессия не записана: ${reason}`,
    markerNotClaimed: ({ file, reason }) => `отметка ${file} не забрана: ${reason}`,
  },
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
