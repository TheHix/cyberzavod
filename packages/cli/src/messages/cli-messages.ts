// Тексты CLI для человека: справка, вопросы мастера, сводки и ошибки. Значение — строка или
// функция от того, что в неё подставляют; при двух и более параметрах — один объект с именованными
// полями. Язык выбирает `languageOf`, наборы лежат в `en.ts` и `ru.ts`.

import type { RecordType } from "@cyberzavod/core";

/** Команды CLI: у каждой есть справка в каталоге сообщений. */
export const COMMAND_NAMES = [
  "init",
  "sync",
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

/** Тексты команды `init`. */
export interface InitMessages {
  rulesKept(file: string): string;
  rulesMoved(params: { from: string; to: string }): string;
  rulesStarter(file: string): string;
  created: string;
  ignoredEntry(entry: string): string;
  journal(path: string): string;
  nextSteps: string;
}

/** Тексты мастера: сводка найденного и вопросы. */
export interface WizardMessages {
  project(params: { name: string; root: string }): string;
  languages(values: string): string;
  frameworks(values: string): string;
  packageManager(value: string): string;
  git(hasGit: boolean): string;
  scripts(values: string): string;
  /** Что показать вместо пустого списка найденного. */
  nothingFound: string;
  packageManagerMissing: string;
  projectIdQuestion: string;
  workflowQuestion: string;
  modelQuestion(params: { title: string; agent: string }): string;
  journalQuestion: string;
  commandsQuestion(separator: string): string;
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
  wizard: WizardMessages;
  sync: SyncMessages;
  status: StatusMessages;
  journal: JournalMessages;
  login: LoginMessages;
  share: ShareMessages;
  gallery: GalleryMessages;
  errors: ErrorMessages;
}
