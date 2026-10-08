// Тексты CLI для человека: справка, сводки, подтверждение и ошибки. Значение — строка или
// функция от того, что в неё подставляют; при двух и более параметрах — один объект с именованными
// полями. Язык выбирает `languageOf`, наборы лежат в `en.ts` и `ru.ts`.

import type { RecordType } from "@cyberzavod/core";

/** Команды CLI: у каждой есть справка в каталоге сообщений. */
export const COMMAND_NAMES = [
  "init",
  "sync",
  "doctor",
  "status",
  "decision",
  "note",
  "draft",
  "publish",
  "login",
  "logout",
  "share",
  "unshare",
  "gallery",
  "hook",
] as const;

/** Имя команды CLI. */
export type CommandName = (typeof COMMAND_NAMES)[number];

/** Разделы справки в порядке показа. Служебные команды в раздел не входят и в списке скрыты. */
export const COMMAND_SECTIONS = ["start", "journal", "gallery", "maintenance"] as const;

/** Раздел справки. */
export type CommandSection = (typeof COMMAND_SECTIONS)[number];

/** Флаг, аргумент или переменная окружения команды и их описание. */
export interface CommandParameter {
  name: string;
  description: string;
}

/**
 * Справка по команде: строка вызова без имени программы, короткое описание для списка команд
 * (одна строка) и параметры для справки самой команды.
 */
export interface CommandHelp {
  usage: string;
  summary: string;
  parameters: readonly CommandParameter[];
}

/** Тексты справки. */
export interface HelpMessages {
  title: string;
  /** Строка «с чего начать» под заголовком. */
  quickStart: string;
  /** Заголовки разделов списка команд. */
  sections: Readonly<Record<CommandSection, string>>;
  /** Строка о том, как узнать подробности команды. */
  commandHelpHint: string;
  /** Заголовок списка параметров в справке команды. */
  parametersTitle: string;
  /** Строка про выбор языка; `languages` — поддерживаемые коды через «|». */
  languageOption(languages: string): string;
}

/** Тексты команды `init`: сводка перед вопросом, вопрос и итог. Строки сводки — без отступа. */
export interface InitMessages {
  summaryTitle: string;
  projectId(id: string): string;
  /** Проверки, найденные или заданные флагом; `commands` — через запятую. */
  checks(commands: string): string;
  /** Проверок нет; `file` — конфиг проекта, куда их можно вписать. */
  checksMissing(file: string): string;
  rulesStarter(file: string): string;
  rulesMoved(params: { from: string; to: string }): string;
  rulesKept(file: string): string;
  journal(path: string): string;
  /** Файлы, которые появятся; `paths` — через запятую. */
  files(paths: string): string;
  overrideHint: string;
  confirm: string;
  cancelled: string;
  done: string;
  /** Что закоммитить; `paths` — через запятую. */
  commit(paths: string): string;
  nextSteps: string;
}

/** Тексты команды `sync`. */
export interface SyncMessages {
  written: string;
  removed: string;
  writtenByHuman: string;
  outdated: string;
  extra: string;
  harnessMismatch(params: { file: string; configVersion: string; cliVersion: string }): string;
  filesOutdated: string;
}

/**
 * Тексты команды `doctor`: подпись и подсказка на каждый исход каждой проверки. Подпись `passed` и
 * `notice` описывает найденное, `problem` — что не так; подсказка — одно действие.
 */
export interface DoctorMessages {
  /** Подсказка под строкой с ✗ без отступа; `text` — действие. */
  fix(text: string): string;
  /** Подсказка под строкой с «–» без отступа; `text` — необязательное действие. */
  hint(text: string): string;
  allPassed: string;
  problems(count: number): string;
  node: {
    passed(version: string): string;
    tooOld(params: { version: string; minimum: number }): string;
    install(minimum: number): string;
  };
  git: { passed: string; missing: string; install: string };
  gallery: {
    signedIn: string;
    notSignedIn: string;
    signIn: string;
    corrupt: string;
    signInAgain: string;
  };
  config: {
    passed(params: { file: string; projectId: string; harness: string }): string;
    notFound(directory: string): string;
    init: string;
    invalid(reason: string): string;
    repair(file: string): string;
  };
  hooks: {
    passed(version: string): string;
    missing(file: string): string;
    otherVersion(params: { file: string; found: string; configVersion: string }): string;
    incomplete(events: string): string;
    unreadable(reason: string): string;
    sync: string;
    repairSettings(file: string): string;
  };
  files: {
    upToDate: string;
    versionsDiffer(params: { file: string; configVersion: string; cliVersion: string }): string;
    matchVersion(configVersion: string): string;
    outdated(count: number): string;
    sync: string;
    writtenByHuman(files: string): string;
    moveToRules(rulesFile: string): string;
    cannotCheck(reason: string): string;
    fixCause: string;
  };
  rules: {
    passed(file: string): string;
    missing(file: string): string;
    create: string;
    unfilled(file: string): string;
    fill: string;
  };
  commands: {
    noneSet(file: string): string;
    setUp(file: string): string;
    programsFound(programs: string): string;
    programsMissing(programs: string): string;
    fixPrograms(file: string): string;
    allPassed(count: number): string;
    /** Команда в кавычках языка. */
    quoted(command: string): string;
    exited(params: { command: string; code: number }): string;
    notStarted(params: { command: string; reason: string }): string;
    failed(commands: string): string;
    runYourself(commands: string): string;
  };
  gitignore: {
    passed(entry: string): string;
    nothingToIgnore: string;
    missing(entry: string): string;
    add(params: { entry: string; file: string }): string;
  };
}

/** Тексты команды `status`. */
export interface StatusMessages {
  recordTypes: Readonly<Record<RecordType, string>>;
  foreman: string;
  checksNone: string;
  project(params: { id: string; root: string }): string;
  harness(version: string): string;
  harnessOutdated(params: { version: string; cliVersion: string }): string;
  workflow(name: string): string;
  checks(commands: string): string;
  journal(params: { path: string; counts: string }): string;
  latestRecord(params: { timestamp: string; type: RecordType }): string;
}

/** Тексты команд `decision` и `note`. */
export interface JournalMessages {
  recorded(path: string): string;
}

/** Тексты команд `login` и `logout`. */
export interface LoginMessages {
  openVerification(params: { url: string; code: string }): string;
  waiting: string;
  loggedIn(login: string): string;
  loggedOut: string;
  wasNotLoggedIn: string;
}

/** Тексты команд `share` и `unshare`. */
export interface ShareMessages {
  sent(id: string): string;
  replaced(id: string): string;
  link(url: string): string;
  galleryClosed: string;
  openGalleryHint: string;
  removed(id: string): string;
  galleryRecordings(params: { count: number; limit: number }): string;
  freeUpSpace: string;
}

/** Тексты команды `gallery`. */
export interface GalleryMessages {
  closed(login: string): string;
  open(login: string): string;
  recordings(params: { count: number; limit: number }): string;
  openHint: string;
  closeHint: string;
  page(url: string): string;
  badge(markdown: string): string;
}

/** Тексты ошибок для человека: то, что он исправляет сам. */
export interface ErrorMessages {
  missingDecisionText: string;
  missingNoteText: string;
  missingRecordId: string;
  unknownHook(name: string): string;
  unknownCommand(name: string): string;
  unknownCommandWithSuggestion(params: { name: string; suggestion: string }): string;
  languageFlagWithoutValue: string;
  unsupportedLanguage(params: { value: string; supported: string }): string;
  projectNotFound(directory: string): string;
  alreadyConnected(file: string): string;
  blankOption(option: string): string;
  absoluteJournal(path: string): string;
  journalIsProjectRoot(path: string): string;
  invalidRecordId(id: string): string;
  recordMissing(params: { id: string; file: string }): string;
  recordInvalid(params: { id: string; reason: string }): string;
  recordNotSession(params: { id: string; type: RecordType }): string;
  galleryAccessConflict: string;
  notLoggedIn: string;
  tokenRejected: string;
  limitReached: string;
  credentialsCorrupt(file: string): string;
  loginCodeExpired: string;
  loginDenied: string;
  noConnection(params: { origin: string; reason: string }): string;
  githubUnexpectedField(name: string): string;
  githubNoDeviceCode: string;
  githubNoToken: string;
  githubRejected(reason: string): string;
  serverUnexpectedResponse(field: string): string;
  serverStatus(status: number): string;
}

/** Все тексты CLI. */
export interface CliMessages {
  help: HelpMessages;
  commands: Readonly<Record<CommandName, CommandHelp>>;
  init: InitMessages;
  sync: SyncMessages;
  doctor: DoctorMessages;
  status: StatusMessages;
  journal: JournalMessages;
  login: LoginMessages;
  share: ShareMessages;
  gallery: GalleryMessages;
  errors: ErrorMessages;
}
