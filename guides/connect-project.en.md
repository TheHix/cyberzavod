---
title: Connect your project to the factory
description: How to connect your project to Cyberzavod with npx cyberzavod init, run a task through the floor of agents and publish a session recording.
order: 1
---

## How it works

Cyberzavod is a local harness for development with AI agents. It does not write code itself and does not replace your agent. It sets the process: stages, roles, shared principles and checks. From that process it generates the files your agent understands, and it keeps a log of sessions and decisions. Your stack may change, and so may the agent. The process stays the same.

The default process: task → plan → code → review → verify → record. The first agent the factory supports is Claude Code. Its hooks write the session log. The log becomes a session recording: stages, prompts, station messages, time and tokens. The floor on the site plays that recording back.

Nothing goes over the network until you ask for it: only the commands that share a recording on the site talk to the server. The config, the tool itself and the log live in your repository. You don't need a clone of Cyberzavod: the factory site is just one of the showcases that can play a log back.

## What you need

- Claude Code.
- Node 22 or newer and `git`. Nothing else: no `jq`, no bash, no global packages. Linux, macOS and Windows work the same.

The project itself can use any language, framework and issue tracker.

## Connect the project: npx cyberzavod init

From the root of your project:

```bash
npx cyberzavod init
```

npm is needed only here. `init` puts the whole tool — a single file with no dependencies — into the project, at `.cyberzavod/bin/cyberzavod.mjs`. The agent hooks and every later command run it with plain `node`. The wizard detects the project: languages, frameworks, package manager, git and scripts. Then it asks a few questions, each with a default answer:

- the project `id` — Latin letters, digits, `-` and `_`; recordings name the project by it;
- the process — `default`;
- the agent for each stage — only Claude Code for now, model `default` (the adapter picks it);
- the check commands — the wizard suggests them from the project scripts, for example `make check` or `npm run test`;
- where to keep the log — inside the project by default, `.cyberzavod/journal`. It can live outside the repository too, for example `../<project>.cyberzavod`.

What was detected is a hint, not a limit: you can answer any question differently. `init --yes` takes all the default answers; without a terminal (cloud, CI, `</dev/null`) the wizard does the same for every question the input has no answer to.

What appears in the project:

- `.cyberzavod/bin/cyberzavod.mjs` — the tool itself. Commit it: that way the hooks work in any clone of the project;
- `.cyberzavod/project.json` — the project marker and config: `projectId`, harness version, process, log path, the agent for each stage (`provider`, `agent`, `model`), checks (`verification.commands` and code directories `verification.paths`) and an informational `stack`;
- `AGENTS.md` — project rules for agents and people. If the project already had a handwritten `CLAUDE.md`, it becomes `AGENTS.md`; otherwise a template is added;
- `CLAUDE.md` — a thin entry point for Claude Code: process, checks, principles and a link to `AGENTS.md`. The factory generates it; don't edit it by hand;
- `.claude/agents/` — stage agents `analyst`, `coder`, `reviewer`, `tester` and the recording editor `recording-editor`;
- `.claude/skills/` — the `/feature` and `/publish-recording` skills;
- `.claude/settings.json` — recording and stop hooks (`node .cyberzavod/bin/cyberzavod.mjs hook …`) and a rule that forbids reading and editing `.env`. The factory doesn't touch your own settings and hooks in this file;
- a line in `.gitignore` — the log's `capture/`: raw session logs stay out of git.

`init` leaves an already connected project alone.

## What to do by hand

1. Fill in `AGENTS.md`. Agents read it first. It needs:
   - the formatting command (if there is none, the step is skipped);
   - the check commands;
   - where tasks live, how to read them and how to reference them in commits;
   - code and test rules: the coder writes by them, the tester and reviewer check against them.
2. Check `verification` in `.cyberzavod/project.json`. The commands run in order every time an agent that changed code in `paths` stops (an empty list means the whole repository). While they are red, the agent can't finish its turn. Don't put here anything that needs an environment the agent doesn't have, such as Docker: leave that to CI.
3. Commit `.cyberzavod/`, `AGENTS.md`, `CLAUDE.md`, `.claude/` and `.gitignore`.

## When something changed: cyberzavod sync

The agent files are derived from the factory harness and the project config. After editing the config, run:

```bash
node .cyberzavod/bin/cyberzavod.mjs sync
```

To move to a new factory version, run `npx cyberzavod@latest sync`: it rewrites both the agent files and `.cyberzavod/bin/cyberzavod.mjs`.

`sync` overwrites only files marked "Generated by `cyberzavod sync`" (the mark itself is in Russian: «Сгенерировано `cyberzavod sync`»). If one of your own files sits in place of such a file, `sync` refuses and changes nothing. `sync --force` overwrites it, and `sync --check` only reports what is out of date; it is handy to add to the project checks. `node .cyberzavod/bin/cyberzavod.mjs status` shows the config, the stage agents and how many records the log holds.

## A task through the floor: /feature

Open Claude Code in the project directory and run:

```text
/feature <task>
```

The task is a description, a link or a number in the tracker: `AGENTS.md` says how to read it. The working tree must be clean.

The lead, that is the session itself, doesn't write code; it hands the work to the stages. Each stage is an agent from `.claude/agents/` with its own model; with `model: "default"` the adapter picks it:

- plan — `analyst`, Opus: a mistake in the plan costs the most;
- code — `coder`, Sonnet, and Opus on the second rework;
- review — `reviewer`, Opus;
- verify — `tester`, Sonnet.

How the work goes:

1. Plan. `analyst` studies the code and writes a plan with acceptance criteria. The lead shows it in full along with the questions and waits for your approval.
2. Code. `coder` does the task by the plan.
3. Review. `reviewer` reads the changes. "Needs work" is a rework.
4. Verify. `tester` checks the result against the criteria and runs the project checks. A defect is a rework.
5. Record. Commits follow the rules in `AGENTS.md`. If `AGENTS.md` describes publishing and deployment, the lead does those too. Decisions that matter in the long run go into the log with the `decision` command, notes with the `note` command of the same CLI.

### Reworks

Reworks from review, verify and record are counted together:

1. the first — `coder` on its own model;
2. the second — `coder` on a stronger model;
3. the third — stop: the lead shows the remaining remarks and what has been tried, and calls you.

### The stop hook

While the checks are red and the agent changed code in this turn, the stop hook doesn't let it finish the turn. After three failed attempts in a row it stops and calls a human. Uncommitted changes made by someone else before the turn don't hold the agent.

## The log

The log is the directory from the config (`journal`), `.cyberzavod/journal` by default. It is yours and lives in your repository. Every record is a separate JSON file:

- `sessions/` — agent session recordings;
- `decisions/` — decisions (`node .cyberzavod/bin/cyberzavod.mjs decision "<decision>" --why "<why>"`);
- `notes/` — notes (`node .cyberzavod/bin/cyberzavod.mjs note "<text>"`);
- `capture/` — the adapter's working files: raw session logs and recording drafts. They hold the original text of your prompts, so `init` hides `capture/` from git.

Every record has the same envelope: version, type, time, project, session, source (agent or human) and data. This format is the whole contract between the tool and a showcase: you can build your own floor to visualize your own log.

## Publish a recording: /publish-recording

Run `/publish-recording` in Claude Code in the project directory. The skill walks you through the steps:

1. Draft. `draft` builds it from the most recent raw log. The draft goes to `capture/claude/drafts/` of the log.
2. Editing. The session writes the recording title and rewrites your prompts into a clean form: the main instruction and the clarifications. The `recording-editor` agent writes the station and foreman messages and the human interventions, that is, the moments when the automation waited for your word.
3. Human review. The skill shows tables of prompts, messages and interventions. Read them carefully: what you approve goes into the recording. Publishing scans the text for addresses and keys, but that is only a safety net.
4. Publishing. `publish` checks the format and writes `sessions/<id>.json` to the project log.

If one session handled several tasks, each one is published as a separate recording: the skill marks them up in the draft itself.

### How a recording gets onto cyberzavod.com

A published recording is shared from the CLI straight into your personal gallery on the site. You need neither a clone of the factory nor a pull request.

1. Sign in with GitHub:

   ```bash
   node .cyberzavod/bin/cyberzavod.mjs login
   ```

   The command shows a code and the address `https://github.com/login/device`: open it, enter the code and confirm. The factory asks GitHub only for your public profile, to learn your login. The token is kept in your user settings directory (`~/.config/cyberzavod/credentials.json`, `%APPDATA%\cyberzavod` on Windows), outside the project; `logout` removes it.

2. Share the recording by its `id` — the name of the file in `sessions/` of the log:

   ```bash
   node .cyberzavod/bin/cyberzavod.mjs share <id>
   ```

   Before sending, `share` checks the recording the same way the site does. In reply it prints a link like `https://cyberzavod.com/r/?id=<slug>`: the same floor and build log as on the recordings on the home page. Sharing the same `id` again replaces the recording, and the link stays the same.

3. The gallery is private by default: a recording is visible only to those who have the link. To list the gallery on the site, open it:

   ```bash
   node .cyberzavod/bin/cyberzavod.mjs gallery --public
   ```

   An open gallery appears in the list of [galleries](/gallery/), gets its own page `/gallery/?user=<login>` and counts in the [analytics](/stats/) of builds: where the process stalls, how many tokens go, when a human is called. `gallery --private` closes it again; the links to recordings keep working.

A gallery holds up to 5 recordings; replacing a recording doesn't count as a new one. When the limit is reached, `share` lists your recordings: free a slot with `unshare <id>`. `gallery` without flags shows the recordings with their links, whether the gallery is open, and the limit.

For an open gallery, `gallery` also prints a badge line for the README: the "cyberzavod | N builds" badge links to the gallery. The same line with a copy button is on the gallery page.

```markdown
[![Built at Cyberzavod](https://cyberzavod.com/api/badges/<login>.svg)](https://cyberzavod.com/gallery/?user=<login>)
```

The same can be done on the site, without a terminal: sign in with GitHub in the menu (on a phone, in the Builds panel) and open [your account](/me/). There you open or close the gallery, see your recordings with their links, delete the ones you no longer need and copy the badge line. Recordings are still uploaded only from the project, with `share`.

### A project on the factory's home page

The home page and the project pages of the site are built from the factory repository: recordings from its `.cyberzavod/journal/sessions/` and project cards from `projects/`. To have your project there with a card, open a pull request to the [factory repository](https://github.com/bysavelii/cyberzavod) with two files:

- the recording `.cyberzavod/journal/sessions/<id>.json` from your project log;
- the card `projects/<id>.json`: `id`, `name` and a one-line `description` in every site language (`{ "en": …, "ru": … }`) and optional `repo` and `website`, `https` only, and `stack` — up to six labels such as `["TypeScript", "Vite"]`.

Before that, run `pnpm install` and `make check-web` in the clone: it builds the site and catches a broken card or recording.

## If something doesn't work

- The log isn't written. Check that `.cyberzavod/bin/cyberzavod.mjs` is in place and `node` is on the `PATH` of the shell that runs Claude Code. If the file is missing, `npx cyberzavod sync` brings it back.
- The hooks were connected mid-session. The log has no session start, so the recording has an empty project, harness version and process. You can fill them in at the editing step, but it is simpler to start a new session.
- The stop hook won't let go. That means the checks are red: fix what they print. With a broken `.cyberzavod/project.json` or without `git`, the hook lets the agent go with a message and checks nothing.
- `sync` refuses. One of your own files sits in place of a generated file: move its rules into `AGENTS.md` and run `sync --force`.

## A live example

The factory has built three reference projects from scratch. Each one started with a single human prompt for a series of tasks, and the lead ran that series through the process on its own: plan, code, review, verify, record. After its series, Split the Bill got more work on new human prompts. Each task is a separate recording; the project page lists its builds in task order, along with the totals: time, tokens, reworks and human involvement. The recordings themselves are in Russian.

- Split the Bill is a web app in TypeScript and Vite: [project page](/projects/split-bill/). In the recording ["The Share link: the bill in the page address"](/recordings/2026-10-07-79fd668f-3/) the review tries to break the link parser and returns the task: a forged link crashed the page.
- dupes is a command-line tool in Rust: [project page](/projects/dupes/). In the recording ["Safe cleanup to the trash, JSON and README"](/recordings/2026-10-07-aa4e0a7d-3/) the review returns the move to the trash twice, until the tool no longer puts real files at risk.
- doc-diff compares versions of a contract, in Python: [project page](/projects/doc-diff/). The recording ["The doc-diff skeleton and text extraction from PDF and DOCX"](/recordings/2026-10-07-4948cd46/) opens the series: it holds the human's prompt for all five tasks at once.

The sources of the harness, the CLI and the Claude Code adapter are in the factory repository: [`harness/`](https://github.com/bysavelii/cyberzavod/tree/main/harness), [`packages/cli`](https://github.com/bysavelii/cyberzavod/tree/main/packages/cli) and [`adapters/claude`](https://github.com/bysavelii/cyberzavod/tree/main/adapters/claude). They ship to npm as a single package, `cyberzavod`.
