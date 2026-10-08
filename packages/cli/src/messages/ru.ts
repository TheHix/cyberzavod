// Русские тексты CLI.

import { HOOK_NAMES } from "@cyberzavod/adapter-claude";
import type { CliMessages } from "./cli-messages.ts";

/** Тексты CLI на русском. */
export const ru: CliMessages = {
  help: {
    title: "Cyberzavod — процесс разработки с ИИ-агентами, локально.",
    languageOption: (languages) =>
      `Язык сообщений: --lang ${languages} или переменная CYBERZAVOD_LANG; без них — по локали системы.`,
  },
  commands: {
    init: {
      usage: "init [--yes]",
      summary: "подключить проект в текущем каталоге: мастер, конфиг, AGENTS.md, файлы агента",
    },
    sync: {
      usage: "sync [--check] [--force]",
      summary: "заново найти стек и пересобрать файлы агента; --check — только проверить",
    },
    status: {
      usage: "status",
      summary: "проект, процесс, агенты этапов, проверки и журнал",
    },
    decision: {
      usage: 'decision "<что решили>" [--why "<почему>"]',
      summary: "записать решение в журнал",
    },
    note: {
      usage: 'note "<текст>"',
      summary: "записать заметку в журнал",
    },
    draft: {
      usage: "draft [<сырой журнал сессии>]",
      summary: "собрать черновик записи из журнала сессии Claude Code",
    },
    publish: {
      usage: "publish [--draft <черновик>] [--build <id сборки>]",
      summary: "опубликовать отредактированный черновик записями в журнал",
    },
    login: {
      usage: "login",
      summary:
        "войти через GitHub, чтобы публиковать записи в галерею (адрес сервера — CYBERZAVOD_API_URL)",
    },
    logout: {
      usage: "logout",
      summary: "забыть сохранённый токен GitHub",
    },
    share: {
      usage: "share <id записи>",
      summary: "отправить запись сессии из журнала в вашу галерею и показать ссылку на неё",
    },
    unshare: {
      usage: "unshare <id записи>",
      summary: "убрать запись из вашей галереи",
    },
    gallery: {
      usage: "gallery [--public | --private]",
      summary:
        "ваши записи в галерее, лимит и ссылки; --public открывает галерею, --private закрывает",
    },
    hook: {
      usage: `hook <${HOOK_NAMES.join("|")}>`,
      summary: "хук Claude Code: событие на stdin; его вызывают настройки проекта, а не человек",
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
      "Закоммитьте .cyberzavod/, AGENTS.md, CLAUDE.md и .claude/: хуки запускают CLI из проекта.\n" +
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
    filesOutdated: "Файлы агента устарели: запустите cyberzavod sync",
  },
  status: {
    recordTypes: { session: "сессии", decision: "решения", note: "заметки" },
    foreman: "ведущий",
    checksNone: "не заданы",
    project: ({ id, root }) => `Проект: ${id} (${root})`,
    harness: (version) => `Harness: ${version}`,
    harnessOutdated: ({ version, cliVersion }) =>
      `Harness: ${version} (CLI — ${cliVersion}, запустите cyberzavod sync)`,
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
    openGalleryHint: "открыть галерею: cyberzavod gallery --public",
    removed: (id) => `запись ${id} удалена из галереи`,
    galleryRecordings: ({ count, limit }) => `Записи в галерее (${count} из ${limit}):`,
    freeUpSpace: "Освободите место командой cyberzavod unshare <id>",
  },
  gallery: {
    closed: (login) => `Галерея ${login}: закрыта, записи видны только по ссылкам`,
    open: (login) => `Галерея ${login}: открыта`,
    recordings: ({ count, limit }) => `Записи: ${count} из ${limit}`,
    openHint: "Открыть галерею: cyberzavod gallery --public",
    closeHint: "Закрыть галерею: cyberzavod gallery --private",
    page: (url) => `Страница галереи: ${url}`,
    badge: (markdown) => `Бейдж для README: ${markdown}`,
  },
  errors: {
    missingDecisionText: "нужен текст решения",
    missingNoteText: "нужен текст заметки",
    missingRecordId: "нужен id записи",
    unknownHook: (name) => `нет хука ${name}`,
    languageFlagWithoutValue: "у --lang нет значения: укажите язык, например --lang ru",
    unsupportedLanguage: ({ value, supported }) =>
      `язык «${value}» не поддерживается: доступны ${supported}`,
    projectNotFound: (directory) => `${directory} не в проекте Cyberzavod: сначала cyberzavod init`,
    alreadyConnected: (file) => `${file} уже есть: проект подключён, используйте sync`,
    toolFromSources:
      "CLI запущен из исходников: соберите его (pnpm cyberzavod) и запустите собранный",
    invalidRecordId: (id) => `${id} не похож на id записи: только буквы, цифры, «_» и «-»`,
    recordMissing: ({ id, file }) => `в журнале нет записи ${id}: файла ${file} не существует`,
    recordInvalid: ({ id, reason }) => `запись ${id} не прошла проверку: ${reason}`,
    recordNotSession: ({ id, type }) =>
      `запись ${id} не прошла проверку: тип ${type}, нужна сессия`,
    galleryAccessConflict: "--public и --private вместе не работают: выберите одно",
    notLoggedIn: "нет входа: войдите командой cyberzavod login",
    tokenRejected: "сервер не принял токен: войдите командой cyberzavod login",
    limitReached: "в галерее уже максимум записей",
    credentialsCorrupt: (file) =>
      `файл ${file} повреждён: войдите заново командой cyberzavod login`,
    loginCodeExpired: "код входа истёк: запустите cyberzavod login заново",
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
