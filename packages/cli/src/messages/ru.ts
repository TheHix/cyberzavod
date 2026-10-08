// Русские тексты CLI.

import { CLI_COMMAND, HOOK_NAMES } from "@cyberzavod/adapter-claude";
import { API_URL_VARIABLE, DEFAULT_API_URL } from "../sharing/services.ts";
import type { CliMessages } from "./cli-messages.ts";

/** Тексты CLI на русском. */
export const ru: CliMessages = {
  help: {
    title: "Cyberzavod — процесс разработки с ИИ-агентами, локально.",
    quickStart: `Старт: ${CLI_COMMAND} init, затем в Claude Code /setup и /feature <задача>.`,
    sections: {
      start: "Начало",
      journal: "Журнал",
      gallery: "Галерея",
      maintenance: "Обслуживание",
    },
    commandHelpHint: `Подробнее о команде: ${CLI_COMMAND} <команда> --help`,
    parametersTitle: "Параметры:",
    languageOption: (languages) => `Язык: --lang ${languages}, CYBERZAVOD_LANG или локаль системы.`,
  },
  commands: {
    init: {
      usage: "init [--yes]",
      summary: "подключить проект: мастер, конфиг, AGENTS.md, файлы агента",
      parameters: [
        { name: "--yes, -y", description: "взять предложенные ответы, ничего не спрашивать" },
      ],
    },
    sync: {
      usage: "sync [--check] [--force]",
      summary: "заново распознать стек и пересобрать файлы агента",
      parameters: [
        { name: "--check", description: "только сообщить, что устарело; выход 1, если есть" },
        { name: "--force", description: "перезаписать файлы, написанные человеком" },
      ],
    },
    status: {
      usage: "status",
      summary: "проект, процесс, агенты этапов, проверки и журнал",
      parameters: [],
    },
    decision: {
      usage: 'decision "<что решили>" [--why "<почему>"]',
      summary: "записать решение в журнал",
      parameters: [
        { name: '"<что решили>"', description: "текст решения" },
        { name: "--why", description: "причина, она сохраняется вместе с решением" },
      ],
    },
    note: {
      usage: 'note "<текст>"',
      summary: "записать заметку в журнал",
      parameters: [{ name: '"<текст>"', description: "текст заметки" }],
    },
    draft: {
      usage: "draft [<сырой журнал сессии>]",
      summary: "собрать черновик записи из журнала сессии Claude Code",
      parameters: [
        {
          name: "<сырой журнал сессии>",
          description: "путь к журналу; без него — самый свежий сырой журнал",
        },
      ],
    },
    publish: {
      usage: "publish [--draft <черновик>] [--build <id сборки>]",
      summary: "опубликовать отредактированный черновик записями в журнал",
      parameters: [
        { name: "--draft", description: "путь к черновику; без него — самый свежий" },
        { name: "--build", description: "сборка черновика; без неё — все" },
      ],
    },
    login: {
      usage: "login",
      summary: "войти через GitHub, чтобы публиковать записи в галерею",
      parameters: [
        {
          name: API_URL_VARIABLE,
          description: `адрес сервера; по умолчанию ${DEFAULT_API_URL}`,
        },
      ],
    },
    logout: {
      usage: "logout",
      summary: "забыть сохранённый токен GitHub",
      parameters: [],
    },
    share: {
      usage: "share <id записи>",
      summary: "отправить запись из журнала в вашу галерею",
      parameters: [{ name: "<id записи>", description: "id записи сессии" }],
    },
    unshare: {
      usage: "unshare <id записи>",
      summary: "убрать запись из вашей галереи",
      parameters: [{ name: "<id записи>", description: "id записи в галерее" }],
    },
    gallery: {
      usage: "gallery [--public | --private]",
      summary: "ваша галерея: записи, лимит, ссылки; открыть или закрыть",
      parameters: [
        { name: "--public", description: "открыть галерею" },
        { name: "--private", description: "закрыть галерею" },
      ],
    },
    hook: {
      usage: `hook <${HOOK_NAMES.join("|")}>`,
      summary: "хук Claude Code: его вызывают настройки проекта, а не человек",
      parameters: [{ name: "<имя хука>", description: "событие приходит на stdin" }],
    },
  },
  init: {
    rulesKept: (file) => `${file} уже есть — оставлен`,
    rulesMoved: ({ from, to }) => `${from} перенесён в ${to}: правила проекта теперь там`,
    rulesStarter: (file) => `${file} — заготовка правил проекта, заполните её`,
    created: "Создано:",
    ignoredEntry: (entry) => `.gitignore: ${entry}`,
    journal: (path) => `Журнал проекта: ${path}`,
    nextSteps:
      "Закоммитьте .cyberzavod/, AGENTS.md, CLAUDE.md и .claude/: хуки запускают cyberzavod через npx, версией из конфига.\n" +
      "Дальше: допишите правила в AGENTS.md и запускайте задачи через /feature в Claude Code.",
  },
  wizard: {
    project: ({ name, root }) => `Проект: ${name} (${root})`,
    languages: (values) => `Языки: ${values}`,
    frameworks: (values) => `Фреймворки: ${values}`,
    packageManager: (value) => `Менеджер пакетов: ${value}`,
    git: (hasGit) => `Git: ${hasGit ? "есть" : "нет"}`,
    scripts: (values) => `Скрипты: ${values}`,
    nothingFound: "не найдены",
    packageManagerMissing: "не найден",
    projectIdQuestion: "Идентификатор проекта",
    workflowQuestion: "Процесс",
    modelQuestion: ({ title, agent }) => `Модель этапа «${title}» (агент ${agent})`,
    journalQuestion: "Каталог журнала от корня проекта",
    commandsQuestion: (separator) => `Команды проверки через «${separator}»`,
  },
  sync: {
    written: "записаны",
    removed: "удалены",
    writtenByHuman: "написаны человеком",
    outdated: "устарели",
    extra: "лишние",
    harnessMismatch: ({ file, configVersion, cliVersion }) =>
      `${file}: harness ${configVersion}, а CLI — ${cliVersion}`,
    filesOutdated: `Файлы агента устарели: запустите ${CLI_COMMAND} sync`,
  },
  status: {
    recordTypes: { session: "сессии", decision: "решения", note: "заметки" },
    foreman: "ведущий",
    checksNone: "не заданы",
    project: ({ id, root }) => `Проект: ${id} (${root})`,
    harness: (version) => `Harness: ${version}`,
    harnessOutdated: ({ version, cliVersion }) =>
      `Harness: ${version} (CLI — ${cliVersion}, запустите ${CLI_COMMAND} sync)`,
    workflow: (name) => `Процесс: ${name}`,
    checks: (commands) => `Проверки: ${commands}`,
    journal: ({ path, counts }) => `Журнал: ${path} — ${counts}`,
    latestRecord: ({ timestamp, type }) => `Последняя запись: ${timestamp} (${type})`,
  },
  journal: {
    recorded: (path) => `записано: ${path}`,
  },
  login: {
    openVerification: ({ url, code }) => `Откройте ${url} и введите код ${code}`,
    waiting: "Жду подтверждения…",
    loggedIn: (login) => `вход выполнен: ${login}`,
    loggedOut: "вы вышли: токен удалён",
    wasNotLoggedIn: "входа и не было",
  },
  share: {
    sent: (id) => `запись ${id} отправлена`,
    replaced: (id) => `запись ${id} заменена`,
    link: (url) => `ссылка: ${url}`,
    galleryClosed: "галерея закрыта: запись видна только по этой ссылке",
    openGalleryHint: `открыть галерею: ${CLI_COMMAND} gallery --public`,
    removed: (id) => `запись ${id} удалена из галереи`,
    galleryRecordings: ({ count, limit }) => `Записи в галерее (${count} из ${limit}):`,
    freeUpSpace: `Освободите место командой ${CLI_COMMAND} unshare <id>`,
  },
  gallery: {
    closed: (login) => `Галерея ${login}: закрыта, записи видны только по ссылкам`,
    open: (login) => `Галерея ${login}: открыта`,
    recordings: ({ count, limit }) => `Записи: ${count} из ${limit}`,
    openHint: `Открыть галерею: ${CLI_COMMAND} gallery --public`,
    closeHint: `Закрыть галерею: ${CLI_COMMAND} gallery --private`,
    page: (url) => `Страница галереи: ${url}`,
    badge: (markdown) => `Бейдж для README: ${markdown}`,
  },
  errors: {
    missingDecisionText: "нужен текст решения",
    missingNoteText: "нужен текст заметки",
    missingRecordId: "нужен id записи",
    unknownHook: (name) => `нет хука ${name}`,
    unknownCommand: (name) => `неизвестная команда «${name}»: все команды — ${CLI_COMMAND} --help`,
    unknownCommandWithSuggestion: ({ name, suggestion }) =>
      `неизвестная команда «${name}»: может быть, ${CLI_COMMAND} ${suggestion}? Все команды: ${CLI_COMMAND} --help`,
    languageFlagWithoutValue: "у --lang нет значения: укажите язык, например --lang ru",
    unsupportedLanguage: ({ value, supported }) =>
      `язык «${value}» не поддерживается: доступны ${supported}`,
    projectNotFound: (directory) =>
      `${directory} не в проекте Cyberzavod: сначала ${CLI_COMMAND} init`,
    alreadyConnected: (file) => `${file} уже есть: проект подключён, используйте sync`,
    invalidRecordId: (id) => `${id} не похож на id записи: только буквы, цифры, «_» и «-»`,
    recordMissing: ({ id, file }) => `в журнале нет записи ${id}: файла ${file} не существует`,
    recordInvalid: ({ id, reason }) => `запись ${id} не прошла проверку: ${reason}`,
    recordNotSession: ({ id, type }) =>
      `запись ${id} не прошла проверку: тип ${type}, нужна сессия`,
    galleryAccessConflict: "--public и --private вместе не работают: выберите одно",
    notLoggedIn: `нет входа: войдите командой ${CLI_COMMAND} login`,
    tokenRejected: `сервер не принял токен: войдите командой ${CLI_COMMAND} login`,
    limitReached: "в галерее уже максимум записей",
    credentialsCorrupt: (file) =>
      `файл ${file} повреждён: войдите заново командой ${CLI_COMMAND} login`,
    loginCodeExpired: `код входа истёк: запустите ${CLI_COMMAND} login заново`,
    loginDenied: "вход отклонён на странице GitHub",
    noConnection: ({ origin, reason }) => `нет связи с ${origin}: ${reason}`,
    githubUnexpectedField: (name) => `GitHub вернул неожиданный ответ: нет поля ${name}`,
    githubNoDeviceCode: "GitHub не выдал код устройства",
    githubNoToken: "GitHub не выдал токен",
    githubRejected: (reason) => `GitHub отклонил вход: ${reason}`,
    serverUnexpectedResponse: (field) =>
      `сервер вернул неожиданный ответ: нет корректного поля ${field}`,
    serverStatus: (status) => `сервер ответил ${status}`,
  },
};
