// English texts of the Claude Code adapter.

import { CLI_COMMAND } from "@cyberzavod/adapter-kit";
import type { ClaudeMessages } from "./claude-messages.ts";

/** Adapter texts in English. */
export const en: ClaudeMessages = {
  draft: {
    configNotRead: (reason) => `project config not read: ${reason}`,
    transcriptNotRead: ({ file, reason }) => `transcript ${file} not read: ${reason}`,
    transcriptsMissing: (count) => `transcripts not found: ${count}, their tokens are not counted`,
    sessionTranscriptNotRead: (reason) =>
      `session transcript not read, there will be no prompt models or session messages: ${reason}`,
    stationTranscriptsMissing: (count) =>
      `station transcripts not found: ${count}, their reports will be missing`,
    intervention: ({ reason, text }) => `intervention (${reason}): ${text}`,
    editNotCarried: (title) => `edit “${title}” was not carried over: no such event in the log`,
    assignmentNotFound: "assignment not found",
    draftFile: (file) => `draft: ${file}`,
    counts: ({ prompts, messages, interventions }) =>
      `prompts: ${prompts}, messages: ${messages}, interventions: ${interventions}`,
    build: ({ id, project, harness, workflow, runs, events }) =>
      `build ${id}: project ${project}, harness ${harness}, workflow ${workflow}, ` +
      `runs: ${runs}, events: ${events}`,
    unfilledHeader: ({ buildId, fields }) => `not filled in: build ${buildId}: ${fields}`,
    projectWithoutBuild: (project) =>
      `commands of project ${project} have no build: they go to the build by time`,
    directoryOutsideProject: (directory) =>
      `directory ${directory} does not belong to a Cyberzavod project: its stages and checks are not in the draft`,
    waiting: (count) => `awaiting editing: ${count}`,
    unassignedRuns: (count) => `station runs without a build (they go to the first): ${count}`,
    unassignedRun: ({ agent, run, clock, line }) => `${agent} ${run} ${clock}: ${line}`,
    orphanedRun: (run) => `run ${run} is listed in a build, but it is not in the log`,
    reroutedMessage: ({ line, from, to }) =>
      `the route of message “${line}” changed: ${from} → ${to}, reread the line`,
  },
  publish: {
    published: (file) => `published: ${file}`,
    notReady: ({ file, problems }) => `${file} is not ready to publish:\n${problems}`,
    buildProblem: ({ buildId, reason }) => `build ${buildId}: ${reason}`,
  },
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `stage ${stage}: ${requested} is not supported by the Claude Code adapter, it runs only ${supported}`,
    noDrafts: `no drafts yet: run ${CLI_COMMAND} draft first`,
    noRawLogs: (directory) => `no session logs yet: the hooks write them to ${directory}`,
    earlierDraftNotParsed: (file) =>
      `the earlier draft ${file} cannot be parsed — fix or delete it`,
    noBuild: (buildId) => `the draft has no build ${buildId}`,
    buildHasNoEvents: (buildId) => `build ${buildId} has no events`,
    leaksFound: ({ buildId, leaks }) =>
      `the text to publish for build ${buildId} contains something that must not be shown: ${leaks}`,
    leakIn: ({ kind, text }) => `${kind} in “${text}”`,
  },
  leakKinds: {
    "ip-address": "IP address",
    "ipv6-address": "IPv6 address",
    email: "email or an address like user@host",
    "server-login": "server login",
    token: "token",
    "url-password": "password in a URL",
    "private-key": "private key",
    "user-path": "path with a user name",
  },
  headerFields: {
    title: "title",
    language: "language",
    project: "project",
    harness: "harness version",
    workflow: "workflow",
  },
};
