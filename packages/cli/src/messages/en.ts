// Английские тексты CLI.

import { CLI_COMMAND, HOOK_NAMES } from "@cyberzavod/adapter-claude";
import { API_URL_VARIABLE, DEFAULT_API_URL } from "../sharing/services.ts";
import type { CliMessages } from "./cli-messages.ts";

/** Тексты CLI на английском. */
export const en: CliMessages = {
  help: {
    title: "Cyberzavod — an AI-agent development process, local-first.",
    quickStart: `Start here: ${CLI_COMMAND} init, then /setup and /feature <task> in Claude Code.`,
    sections: {
      start: "Getting started",
      journal: "Journal",
      gallery: "Gallery",
      maintenance: "Maintenance",
    },
    commandHelpHint: `Command details: ${CLI_COMMAND} <command> --help`,
    parametersTitle: "Parameters:",
    languageOption: (languages) =>
      `Language: --lang ${languages}, CYBERZAVOD_LANG or the system locale.`,
  },
  commands: {
    init: {
      usage: "init [--yes] [--id <id>] [--check <command>] [--journal <path>]",
      summary: "set up the project: config, AGENTS.md, agent files",
      parameters: [
        { name: "--yes, -y", description: "do not ask for confirmation" },
        { name: "--id <id>", description: "project id; default: package or directory name" },
        {
          name: "--check <command>",
          description: "check command, repeatable; replaces the detected ones",
        },
        { name: "--journal <path>", description: "journal directory from the project root" },
      ],
    },
    sync: {
      usage: "sync [--check] [--force]",
      summary: "detect the stack again and rebuild the agent files",
      parameters: [
        { name: "--check", description: "only report what is outdated; exit 1 if anything is" },
        { name: "--force", description: "overwrite files written by a human" },
      ],
    },
    status: {
      usage: "status",
      summary: "project, workflow, stage agents, checks and the journal",
      parameters: [],
    },
    decision: {
      usage: 'decision "<what was decided>" [--why "<why>"]',
      summary: "record a decision in the journal",
      parameters: [
        { name: '"<what was decided>"', description: "the decision text" },
        { name: "--why", description: "the reason, saved with the decision" },
      ],
    },
    note: {
      usage: 'note "<text>"',
      summary: "record a note in the journal",
      parameters: [{ name: '"<text>"', description: "the note text" }],
    },
    draft: {
      usage: "draft [<raw session log>]",
      summary: "build a recording draft from a Claude Code session log",
      parameters: [
        {
          name: "<raw session log>",
          description: "path to the log; default — the newest raw log",
        },
      ],
    },
    publish: {
      usage: "publish [--draft <draft>] [--build <build id>]",
      summary: "publish the edited draft as records in the journal",
      parameters: [
        { name: "--draft", description: "path to the draft; default — the newest one" },
        { name: "--build", description: "draft build to publish; default — all" },
      ],
    },
    login: {
      usage: "login",
      summary: "sign in with GitHub to publish recordings to your gallery",
      parameters: [
        {
          name: API_URL_VARIABLE,
          description: `server address; default ${DEFAULT_API_URL}`,
        },
      ],
    },
    logout: {
      usage: "logout",
      summary: "forget the saved GitHub token",
      parameters: [],
    },
    share: {
      usage: "share <recording id>",
      summary: "send a recording from the journal to your gallery",
      parameters: [{ name: "<recording id>", description: "id of a session recording" }],
    },
    unshare: {
      usage: "unshare <recording id>",
      summary: "remove a recording from your gallery",
      parameters: [{ name: "<recording id>", description: "id of a recording in the gallery" }],
    },
    gallery: {
      usage: "gallery [--public | --private]",
      summary: "your gallery: recordings, limit, links; open or close it",
      parameters: [
        { name: "--public", description: "open the gallery" },
        { name: "--private", description: "close the gallery" },
      ],
    },
    hook: {
      usage: `hook <${HOOK_NAMES.join("|")}>`,
      summary: "Claude Code hook: project settings call it, not a person",
      parameters: [{ name: "<hook name>", description: "the event arrives on stdin" }],
    },
  },
  init: {
    summaryTitle: "Cyberzavod will set up this project:",
    projectId: (id) => `Project id: ${id}`,
    checks: (commands) => `Checks: ${commands}`,
    checksMissing: (file) => `Checks: none found — /setup or edit ${file}`,
    rulesStarter: (file) => `Agent rules: ${file} — a starter set, fill it in`,
    rulesMoved: ({ from, to }) => `Agent rules: your ${from} becomes ${to}`,
    rulesKept: (file) => `Agent rules: ${file} already exists, it stays as is`,
    journal: (path) => `Session journal: ${path}`,
    files: (paths) => `Will appear: ${paths}`,
    overrideHint: `Change: --id, --check, --journal — details: ${CLI_COMMAND} init --help`,
    confirm: "Continue? [Y/n]",
    cancelled: "Cancelled: nothing was written",
    done: "Done: the project is set up.",
    commit: (paths) => `Commit: ${paths}`,
    nextSteps: "Next: open Claude Code and run /setup, then /feature <task>.",
  },
  sync: {
    written: "written",
    removed: "removed",
    writtenByHuman: "written by a human",
    outdated: "outdated",
    extra: "extra",
    harnessMismatch: ({ file, configVersion, cliVersion }) =>
      `${file}: harness ${configVersion}, but the CLI is ${cliVersion}`,
    filesOutdated: `Agent files are outdated: run ${CLI_COMMAND} sync`,
  },
  status: {
    recordTypes: { session: "sessions", decision: "decisions", note: "notes" },
    foreman: "foreman",
    checksNone: "none set",
    project: ({ id, root }) => `Project: ${id} (${root})`,
    harness: (version) => `Harness: ${version}`,
    harnessOutdated: ({ version, cliVersion }) =>
      `Harness: ${version} (CLI is ${cliVersion}, run ${CLI_COMMAND} sync)`,
    workflow: (name) => `Workflow: ${name}`,
    checks: (commands) => `Checks: ${commands}`,
    journal: ({ path, counts }) => `Journal: ${path} — ${counts}`,
    latestRecord: ({ timestamp, type }) => `Latest record: ${timestamp} (${type})`,
  },
  journal: {
    recorded: (path) => `recorded: ${path}`,
  },
  login: {
    openVerification: ({ url, code }) => `Open ${url} and enter the code ${code}`,
    waiting: "Waiting for confirmation…",
    loggedIn: (login) => `signed in: ${login}`,
    loggedOut: "signed out: the token was removed",
    wasNotLoggedIn: "you were not signed in",
  },
  share: {
    sent: (id) => `recording ${id} sent`,
    replaced: (id) => `recording ${id} replaced`,
    link: (url) => `link: ${url}`,
    galleryClosed: "the gallery is closed: the recording is visible only by this link",
    openGalleryHint: `open the gallery: ${CLI_COMMAND} gallery --public`,
    removed: (id) => `recording ${id} removed from the gallery`,
    galleryRecordings: ({ count, limit }) => `Recordings in the gallery (${count} of ${limit}):`,
    freeUpSpace: `Free up space with ${CLI_COMMAND} unshare <id>`,
  },
  gallery: {
    closed: (login) => `${login}'s gallery: closed, recordings are visible only by links`,
    open: (login) => `${login}'s gallery: open`,
    recordings: ({ count, limit }) => `Recordings: ${count} of ${limit}`,
    openHint: `Open the gallery: ${CLI_COMMAND} gallery --public`,
    closeHint: `Close the gallery: ${CLI_COMMAND} gallery --private`,
    page: (url) => `Gallery page: ${url}`,
    badge: (markdown) => `README badge: ${markdown}`,
  },
  errors: {
    missingDecisionText: "the decision text is required",
    missingNoteText: "the note text is required",
    missingRecordId: "the recording id is required",
    unknownHook: (name) => `no hook named ${name}`,
    unknownCommand: (name) => `unknown command “${name}”: all commands — ${CLI_COMMAND} --help`,
    unknownCommandWithSuggestion: ({ name, suggestion }) =>
      `unknown command “${name}”: did you mean ${CLI_COMMAND} ${suggestion}? All commands: ${CLI_COMMAND} --help`,
    languageFlagWithoutValue: "--lang has no value: give a language, for example --lang en",
    unsupportedLanguage: ({ value, supported }) =>
      `language “${value}” is not supported: available are ${supported}`,
    projectNotFound: (directory) =>
      `${directory} is not in a Cyberzavod project: run ${CLI_COMMAND} init first`,
    alreadyConnected: (file) => `${file} already exists: the project is set up, use sync`,
    blankOption: (option) => `${option} is empty: give a value`,
    journalIsProjectRoot: (path) =>
      `--journal ${path} is the project root: give a directory for the journal, for example .cyberzavod/journal`,
    absoluteJournal: (path) =>
      `--journal must be a path from the project root, not an absolute one: ${path}`,
    invalidRecordId: (id) =>
      `${id} does not look like a recording id: only letters, digits, “_” and “-”`,
    recordMissing: ({ id, file }) =>
      `no recording ${id} in the journal: the file ${file} does not exist`,
    recordInvalid: ({ id, reason }) => `recording ${id} failed validation: ${reason}`,
    recordNotSession: ({ id, type }) =>
      `recording ${id} failed validation: its type is ${type}, a session is required`,
    galleryAccessConflict: "--public and --private cannot be combined: pick one",
    notLoggedIn: `not signed in: sign in with ${CLI_COMMAND} login`,
    tokenRejected: `the server did not accept the token: sign in again with ${CLI_COMMAND} login`,
    limitReached: "the gallery already holds the maximum number of recordings",
    credentialsCorrupt: (file) =>
      `the file ${file} is corrupted: sign in again with ${CLI_COMMAND} login`,
    loginCodeExpired: `the sign-in code expired: run ${CLI_COMMAND} login again`,
    loginDenied: "sign-in was denied on the GitHub page",
    noConnection: ({ origin, reason }) => `cannot reach ${origin}: ${reason}`,
    githubUnexpectedField: (name) => `GitHub returned an unexpected response: no field ${name}`,
    githubNoDeviceCode: "GitHub did not issue a device code",
    githubNoToken: "GitHub did not issue a token",
    githubRejected: (reason) => `GitHub rejected the sign-in: ${reason}`,
    serverUnexpectedResponse: (field) =>
      `the server returned an unexpected response: no valid field ${field}`,
    serverStatus: (status) => `the server answered ${status}`,
  },
};
