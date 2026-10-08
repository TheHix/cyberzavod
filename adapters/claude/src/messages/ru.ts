// Русские тексты адаптера Claude Code.

import { CLI_COMMAND } from "../cli-command.ts";
import type { ClaudeMessages } from "./claude-messages.ts";

/** Тексты адаптера на русском. */
export const ru: ClaudeMessages = {
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
  draft: {
    configNotRead: (reason) => `конфиг проекта не прочитан: ${reason}`,
    transcriptNotRead: ({ file, reason }) => `транскрипт ${file} не прочитан: ${reason}`,
    transcriptsMissing: (count) => `транскриптов не найдено: ${count}, их токены не посчитаны`,
    sessionTranscriptNotRead: (reason) =>
      `транскрипт сессии не прочитан, моделей промптов и реплик сессии не будет: ${reason}`,
    stationTranscriptsMissing: (count) =>
      `транскриптов станций не найдено: ${count}, их отчётов не будет`,
    intervention: ({ reason, text }) => `вмешательство (${reason}): ${text}`,
    editNotCarried: (title) => `редактура «${title}» не перенесена: такого события в журнале нет`,
    assignmentNotFound: "задание не найдено",
    draftFile: (file) => `черновик: ${file}`,
    counts: ({ prompts, messages, interventions }) =>
      `промптов: ${prompts}, реплик: ${messages}, вмешательств: ${interventions}`,
    build: ({ id, project, harness, workflow, runs, events }) =>
      `сборка ${id}: проект ${project}, harness ${harness}, процесс ${workflow}, ` +
      `запусков: ${runs}, событий: ${events}`,
    unfilledHeader: ({ buildId, fields }) => `не заполнено: сборка ${buildId}: ${fields}`,
    projectWithoutBuild: (project) =>
      `команды проекта ${project} без сборки: достанутся сборке по времени`,
    directoryOutsideProject: (directory) =>
      `каталог ${directory} не принадлежит проекту Cyberzavod: его этапы и проверки не попали в черновик`,
    waiting: (count) => `ждут редактуры: ${count}`,
    unassignedRuns: (count) => `запуски станций без сборки (достанутся первой): ${count}`,
    unassignedRun: ({ agent, run, clock, line }) => `${agent} ${run} ${clock}: ${line}`,
    orphanedRun: (run) => `запуск ${run} указан в сборке, но в журнале его нет`,
    reroutedMessage: ({ line, from, to }) =>
      `у реплики «${line}» поменялся маршрут: ${from} → ${to}, перечитайте строку`,
  },
  publish: {
    published: (file) => `опубликовано: ${file}`,
    notReady: ({ file, problems }) => `${file} не готов к публикации:\n${problems}`,
    buildProblem: ({ buildId, reason }) => `сборка ${buildId}: ${reason}`,
  },
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `этап ${stage}: ${requested} не поддерживается, пока есть только адаптер ${supported}`,
    fileConflicts: (files) =>
      `эти файлы написаны не генератором, перенесите их содержимое в AGENTS.md или запустите с --force: ${files}`,
    settingsNotObject: (file) => `${file} не разобран: настройки должны быть объектом`,
    settingsNotParsed: ({ file, reason }) => `${file} не разобран: ${reason}`,
    unknownPlaceholder: (placeholder) => `в шаблоне неизвестная подстановка ${placeholder}`,
    projectNotFound: (directory) =>
      `${directory} не в проекте Cyberzavod: сначала ${CLI_COMMAND} init`,
    noDrafts: `черновиков ещё нет: сначала ${CLI_COMMAND} draft`,
    noRawLogs: (directory) => `журналов сессий ещё нет: хуки пишут их в ${directory}`,
    earlierDraftNotParsed: (file) =>
      `прошлый черновик ${file} не разобран — исправьте или удалите его`,
    noBuild: (buildId) => `в черновике нет сборки ${buildId}`,
    buildHasNoEvents: (buildId) => `в сборке ${buildId} нет событий`,
    leaksFound: ({ buildId, leaks }) =>
      `в тексте для публикации сборки ${buildId} есть то, что нельзя показывать: ${leaks}`,
    leakIn: ({ kind, text }) => `${kind} в «${text}»`,
  },
  leakKinds: {
    "ip-address": "IP-адрес",
    "ipv6-address": "IPv6-адрес",
    email: "почта или адрес вида user@host",
    "server-login": "вход на сервер",
    token: "токен",
    "url-password": "пароль в адресе",
    "private-key": "закрытый ключ",
    "user-path": "путь с именем пользователя",
  },
  headerFields: {
    title: "заголовок",
    language: "язык",
    project: "проект",
    harness: "версия harness",
    workflow: "процесс",
  },
};
