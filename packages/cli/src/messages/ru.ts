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
      usage: "init [--yes] [--id <id>] [--check <command>] [--journal <path>]",
      summary: "подключить проект: конфиг, AGENTS.md, файлы агента",
      parameters: [
        { name: "--yes, -y", description: "не спрашивать подтверждение" },
        { name: "--id <id>", description: "id проекта; по умолчанию — имя пакета или каталога" },
        {
          name: "--check <command>",
          description: "команда проверки, можно несколько; заменяет найденные",
        },
        { name: "--journal <path>", description: "каталог журнала от корня проекта" },
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
    doctor: {
      usage: "doctor [--run-checks]",
      summary: "проверить подключение и подсказать, как починить",
      parameters: [
        {
          name: "--run-checks",
          description: "запустить команды проверок, а не только искать их",
        },
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
    summaryTitle: "Cyberzavod подключит этот проект:",
    projectId: (id) => `Id проекта: ${id}`,
    checks: (commands) => `Проверки: ${commands}`,
    checksMissing: (file) => `Проверки: не найдены — /setup или правка ${file}`,
    rulesStarter: (file) => `Правила для агентов: ${file} — заготовка, допишите её`,
    rulesMoved: ({ from, to }) => `Правила для агентов: ваш ${from} станет ${to}`,
    rulesKept: (file) => `Правила для агентов: ${file} уже есть, не изменится`,
    journal: (path) => `Журнал сессий: ${path}`,
    files: (paths) => `Появятся: ${paths}`,
    overrideHint: `Поменять: --id, --check, --journal — подробнее: ${CLI_COMMAND} init --help`,
    confirm: "Продолжить? [Y/n]",
    cancelled: "Отменено: ничего не записано",
    done: "Готово: проект подключён.",
    commit: (paths) => `Закоммитьте: ${paths}`,
    nextSteps: "Дальше: откройте Claude Code и запустите /setup, затем /feature <задача>.",
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
  doctor: {
    fix: (text) => `Как починить: ${text}`,
    hint: (text) => `Подсказка: ${text}`,
    allPassed: "Всё в порядке.",
    problems: (count) => `Проблем: ${count}.`,
    node: {
      passed: (version) => `Node.js ${version}`,
      tooOld: ({ version, minimum }) =>
        `Node.js ${version} слишком старый: нужен ${minimum} или новее`,
      install: (minimum) => `установите Node.js ${minimum} или новее`,
    },
    git: {
      passed: "git установлен",
      missing: "git не найден в PATH",
      install: "установите git и убедитесь, что он в PATH",
    },
    gallery: {
      signedIn: "галерея: вход выполнен",
      notSignedIn: "галерея: вход не выполнен (нужен только для публикации записей)",
      signIn: `чтобы публиковать записи, выполните ${CLI_COMMAND} login`,
      corrupt: "галерея: файл с сохранённым входом повреждён",
      signInAgain: `выполните ${CLI_COMMAND} login заново`,
    },
    config: {
      passed: ({ file, projectId, harness }) => `${file}: проект ${projectId}, harness ${harness}`,
      notFound: (directory) => `проект Cyberzavod не найден от ${directory}`,
      init: `выполните ${CLI_COMMAND} init в корне проекта`,
      invalid: (reason) => `конфиг проекта не годится: ${reason}`,
      repair: (file) => `исправьте ${file} по сообщению выше`,
    },
    hooks: {
      passed: (version) => `хуки агента установлены для ${version}`,
      missing: (file) => `хуки агента не установлены в ${file}`,
      otherVersion: ({ file, found, configVersion }) =>
        `хуки агента в ${file} — для ${found}, а в конфиге ${configVersion}`,
      incomplete: (events) => `хуки агента неполные: нет обработчиков у ${events}`,
      unreadable: (reason) => `хуки агента не проверить: ${reason}`,
      sync: `выполните ${CLI_COMMAND} sync`,
      repairSettings: (file) => `исправьте JSON в ${file}, затем выполните ${CLI_COMMAND} sync`,
    },
    files: {
      upToDate: "файлы агента актуальны",
      versionsDiffer: ({ file, configVersion, cliVersion }) =>
        `в ${file} harness ${configVersion}, а этот CLI ${cliVersion}: файлы агента не сравнить`,
      matchVersion: (configVersion) =>
        `выполните ${CLI_COMMAND} sync или запустите ${CLI_COMMAND}@${configVersion} doctor`,
      outdated: (count) => `файлы агента устарели или лишние: ${count}`,
      sync: `выполните ${CLI_COMMAND} sync (список файлов — ${CLI_COMMAND} sync --check)`,
      writtenByHuman: (files) => `файлы агента написаны человеком: ${files}`,
      moveToRules: (rulesFile) =>
        `перенесите правки в ${rulesFile} и выполните ${CLI_COMMAND} sync --force`,
      cannotCheck: (reason) => `файлы агента не проверить: ${reason}`,
      fixCause: `устраните причину выше и выполните ${CLI_COMMAND} sync --check`,
    },
    rules: {
      passed: (file) => `${file} заполнен`,
      missing: (file) => `${file} не найден`,
      create: "создайте его или запустите /setup в Claude Code",
      unfilled: (file) => `в ${file} остались заглушки заготовки`,
      fill: "запустите /setup в Claude Code",
    },
    commands: {
      noneSet: (file) => `команды проверок не заданы в ${file}`,
      setUp: (file) => `запустите /setup в Claude Code или впишите команды в ${file}`,
      programsFound: (programs) =>
        `программы ${programs} найдены; команды не запускались — ${CLI_COMMAND} doctor --run-checks`,
      programsMissing: (programs) => `программы проверок не найдены: ${programs}`,
      fixPrograms: (file) =>
        `установите программы или поправьте команды в ${file}; команда, начатая со встроенной команды оболочки (cd web && …), не распознаётся: оберните её в make-цель или скрипт либо запустите ${CLI_COMMAND} doctor --run-checks`,
      allPassed: (count) => `команды проверок проходят: ${count}`,
      quoted: (command) => `«${command}»`,
      exited: ({ command, code }) => `«${command}» (код выхода ${code})`,
      notStarted: ({ command, reason }) => `«${command}» (не запустилась: ${reason})`,
      failed: (commands) => `команды проверок не прошли: ${commands}`,
      runYourself: (commands) => `запустите ${commands} сами и посмотрите ошибку`,
    },
    gitignore: {
      passed: (entry) => `.gitignore игнорирует ${entry}`,
      nothingToIgnore: "журнал вне проекта: игнорировать нечего",
      missing: (entry) =>
        `в .gitignore нет строки ${entry}: сырые журналы сессий могут попасть в коммит`,
      add: ({ entry, file }) => `допишите строку ${entry} в ${file}`,
    },
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
    blankOption: (option) => `${option} пуст: укажите значение`,
    journalIsProjectRoot: (path) =>
      `--journal ${path} — это корень проекта: укажите каталог журнала, например .cyberzavod/journal`,
    absoluteJournal: (path) => `--journal — путь от корня проекта, а не абсолютный: ${path}`,
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
