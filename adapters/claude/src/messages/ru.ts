// Russian texts of the Claude Code adapter.

import { CLI_COMMAND } from "@cyberzavod/adapter-kit";
import type { ClaudeMessages } from "./claude-messages.ts";

/** Adapter texts in Russian. */
export const ru: ClaudeMessages = {
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
      `этап ${stage}: ${requested} не поддерживается адаптером Claude Code, он ведёт только ${supported}`,
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
