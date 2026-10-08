// Английские тексты CLI.

import { HOOK_NAMES } from "@cyberzavod/adapter-claude";
import type { CliMessages } from "./cli-messages.ts";

/** Тексты CLI на английском. */
export const en: CliMessages = {
  help: {
    title: "Cyberzavod — an AI-agent development process, local-first.",
    languageOption: (languages) =>
      `Message language: --lang ${languages} or the CYBERZAVOD_LANG variable; otherwise the system locale.`,
  },
  commands: {
    init: {
      usage: "init [--yes]",
      summary:
        "set up the project in the current directory: wizard, config, AGENTS.md, agent files",
    },
    sync: {
      usage: "sync [--check] [--force]",
      summary: "detect the stack again and rebuild the agent files; --check only verifies",
    },
    status: {
      usage: "status",
      summary: "project, workflow, stage agents, checks and the journal",
    },
    decision: {
      usage: 'decision "<what was decided>" [--why "<why>"]',
      summary: "record a decision in the journal",
    },
    note: {
      usage: 'note "<text>"',
      summary: "record a note in the journal",
    },
    draft: {
      usage: "draft [<raw session log>]",
      summary: "build a recording draft from a Claude Code session log",
    },
    publish: {
      usage: "publish [--draft <draft>] [--build <build id>]",
      summary: "publish the edited draft as records in the journal",
    },
    login: {
      usage: "login",
      summary:
        "sign in with GitHub to publish recordings to your gallery (server address — CYBERZAVOD_API_URL)",
    },
    logout: {
      usage: "logout",
      summary: "forget the saved GitHub token",
    },
    share: {
      usage: "share <recording id>",
      summary: "send a session recording from the journal to your gallery and show its link",
    },
    unshare: {
      usage: "unshare <recording id>",
      summary: "remove a recording from your gallery",
    },
    gallery: {
      usage: "gallery [--public | --private]",
      summary:
        "your gallery recordings, the limit and links; --public opens the gallery, --private closes it",
    },
    hook: {
      usage: `hook <${HOOK_NAMES.join("|")}>`,
      summary:
        "Claude Code hook: the event arrives on stdin; project settings call it, not a person",
    },
  },
  init: {
    rulesKept: (file) => `${file} already exists — left as is`,
    rulesMoved: ({ from, to }) => `${from} moved to ${to}: the project rules live there now`,
    rulesStarter: (file) => `${file} — a starter set of project rules, fill it in`,
    created: "Created:",
    ignoredEntry: (entry) => `.gitignore: ${entry}`,
    journal: (path) => `Project journal: ${path}`,
    nextSteps:
      "Commit .cyberzavod/, AGENTS.md, CLAUDE.md and .claude/: the hooks run the CLI from the project.\n" +
      "Next: finish the rules in AGENTS.md and start tasks with /feature in Claude Code.",
  },
  wizard: {
    project: ({ name, root }) => `Project: ${name} (${root})`,
    languages: (values) => `Languages: ${values}`,
    frameworks: (values) => `Frameworks: ${values}`,
    packageManager: (value) => `Package manager: ${value}`,
    git: (hasGit) => `Git: ${hasGit ? "yes" : "no"}`,
    scripts: (values) => `Scripts: ${values}`,
    nothingFound: "none found",
    packageManagerMissing: "not found",
    projectIdQuestion: "Project id",
    workflowQuestion: "Workflow",
    modelQuestion: ({ title, agent }) => `Model for the “${title}” stage (agent ${agent})`,
    journalQuestion: "Journal directory from the project root",
    commandsQuestion: (separator) => `Check commands separated by “${separator}”`,
  },
  sync: {
    written: "written",
    removed: "removed",
    writtenByHuman: "written by a human",
    outdated: "outdated",
    extra: "extra",
    harnessMismatch: ({ file, configVersion, cliVersion }) =>
      `${file}: harness ${configVersion}, but the CLI is ${cliVersion}`,
    filesOutdated: "Agent files are outdated: run cyberzavod sync",
  },
  status: {
    recordTypes: { session: "sessions", decision: "decisions", note: "notes" },
    foreman: "foreman",
    checksNone: "none set",
    project: ({ id, root }) => `Project: ${id} (${root})`,
    harness: (version) => `Harness: ${version}`,
    harnessOutdated: ({ version, cliVersion }) =>
      `Harness: ${version} (CLI is ${cliVersion}, run cyberzavod sync)`,
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
    openGalleryHint: "open the gallery: cyberzavod gallery --public",
    removed: (id) => `recording ${id} removed from the gallery`,
    galleryRecordings: ({ count, limit }) => `Recordings in the gallery (${count} of ${limit}):`,
    freeUpSpace: "Free up space with cyberzavod unshare <id>",
  },
  gallery: {
    closed: (login) => `${login}'s gallery: closed, recordings are visible only by links`,
    open: (login) => `${login}'s gallery: open`,
    recordings: ({ count, limit }) => `Recordings: ${count} of ${limit}`,
    openHint: "Open the gallery: cyberzavod gallery --public",
    closeHint: "Close the gallery: cyberzavod gallery --private",
    page: (url) => `Gallery page: ${url}`,
    badge: (markdown) => `README badge: ${markdown}`,
  },
  errors: {
    missingDecisionText: "the decision text is required",
    missingNoteText: "the note text is required",
    missingRecordId: "the recording id is required",
    unknownHook: (name) => `no hook named ${name}`,
    languageFlagWithoutValue: "--lang has no value: give a language, for example --lang en",
    unsupportedLanguage: ({ value, supported }) =>
      `language “${value}” is not supported: available are ${supported}`,
    projectNotFound: (directory) =>
      `${directory} is not in a Cyberzavod project: run cyberzavod init first`,
    alreadyConnected: (file) => `${file} already exists: the project is set up, use sync`,
    toolFromSources:
      "the CLI is running from sources: build it (pnpm cyberzavod) and run the built one",
    invalidRecordId: (id) =>
      `${id} does not look like a recording id: only letters, digits, “_” and “-”`,
    recordMissing: ({ id, file }) =>
      `no recording ${id} in the journal: the file ${file} does not exist`,
    recordInvalid: ({ id, reason }) => `recording ${id} failed validation: ${reason}`,
    recordNotSession: ({ id, type }) =>
      `recording ${id} failed validation: its type is ${type}, a session is required`,
    galleryAccessConflict: "--public and --private cannot be combined: pick one",
    notLoggedIn: "not signed in: sign in with cyberzavod login",
    tokenRejected: "the server did not accept the token: sign in again with cyberzavod login",
    limitReached: "the gallery already holds the maximum number of recordings",
    credentialsCorrupt: (file) =>
      `the file ${file} is corrupted: sign in again with cyberzavod login`,
    loginCodeExpired: "the sign-in code expired: run cyberzavod login again",
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
