// Stop hook: if the agent changed code in this turn, it cannot finish while the project checks are
// red. No config or no check commands: the agent is let go without checks; a broken config: it is
// let go with a message. The JSON `block` decision with exit code 0 sends the agent back to work:
// the adapter's hooks read a non-zero code as "npx did not start" and let the agent go (see
// generate/settings.ts), so code 2 does not fit here. Infinite loop guard: after MAX_BLOCKS
// refusals per turn the agent is let go, calls the human and leaves the `human-call` marker for the
// session recording; if the counter cannot be written, the agent is let go too. The start of a
// turn resets the counter, so here it only grows.

import { readFile, rm, writeFile } from "node:fs/promises";
import {
  isNotFound,
  PROJECT_CONFIG_FILE,
  ProjectFileError,
  readProjectConfig,
} from "@cyberzavod/storage";
import type { ClaudeMessages } from "../messages/claude-messages.ts";
import type { ProjectConfig } from "@cyberzavod/core";
import { checksOf, runChecks, type ProjectChecks } from "./checks.ts";
import { codeFingerprint, GitError, hasUncommittedChanges } from "./fingerprint.ts";
import { sessionIdOf, SILENT_EXIT, type HookContext, type HookOutcome } from "./hook.ts";
import { hookStatePath, type HookStateName } from "./state.ts";

const MAX_BLOCKS = 3;
const OUTPUT_TAIL_LINES = 40;
const SUCCESS_EXIT_CODE = 0;

/** Stop hook decision. */
type StopVerdict =
  | { kind: "release" }
  | { kind: "release-with-message"; message: string }
  | { kind: "block"; message: string };

const RELEASE: StopVerdict = { kind: "release" };

/** Stop of one session: where its state lives. */
interface StopSession {
  root: string;
  statePath(name: HookStateName): string;
  messages: ClaudeMessages;
}

type ConfigReading = { config: ProjectConfig | undefined } | { broken: ProjectFileError };

async function readConfig(root: string): Promise<ConfigReading> {
  try {
    return { config: await readProjectConfig(root) };
  } catch (err) {
    if (err instanceof ProjectFileError) return { broken: err };

    throw err;
  }
}

async function readState(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// If there is no turn-start fingerprint (hooks were connected mid-turn), the code counts as
// changed whenever the code directories have any uncommitted changes.
async function codeChangedThisTurn(session: StopSession, checks: ProjectChecks): Promise<boolean> {
  const turnStart = await readState(session.statePath("turn-start"));

  if (turnStart === undefined) return hasUncommittedChanges(session.root, checks.paths);

  return turnStart !== codeFingerprint(session.root, checks.paths);
}

// A counter that cannot be read or written gives no protection against an infinite loop: the
// caller turns such a refusal into letting the agent go.
async function countedBlock(counter: string): Promise<number | undefined> {
  try {
    const stored = await readState(counter);
    const blocks = Number.parseInt(stored ?? "0", 10);
    const next = (Number.isNaN(blocks) ? 0 : blocks) + 1;

    await writeFile(counter, String(next));

    return next;
  } catch {
    return undefined;
  }
}

async function written(file: string, text: string): Promise<boolean> {
  try {
    await writeFile(file, text);

    return true;
  } catch {
    return false;
  }
}

function tailOf(output: string): string {
  const lines = output.trimEnd().split("\n");

  return lines.slice(-OUTPUT_TAIL_LINES).join("\n");
}

// The capture hook needs the marker: the human's next prompt answers the stop hook's call.
async function callHuman(session: StopSession, blocks: number): Promise<StopVerdict> {
  const { stop } = session.messages;
  const message = stop.humanCalled(MAX_BLOCKS);
  const marked = await written(session.statePath("human-call"), String(blocks));

  return {
    kind: "release-with-message",
    message: marked ? message : `${message} ${stop.markerNotSaved}`,
  };
}

async function verdictOnRedChecks(
  session: StopSession,
  checks: ProjectChecks,
  output: string,
): Promise<StopVerdict> {
  const { stop } = session.messages;
  const counter = session.statePath("stop-blocks");
  const blocks = await countedBlock(counter);

  if (blocks === undefined) {
    return { kind: "release-with-message", message: stop.counterNotSaved(counter) };
  }
  if (blocks > MAX_BLOCKS) return callHuman(session, blocks);

  return {
    kind: "block",
    message: stop.checksFailing({
      command: checks.command,
      attempt: blocks,
      maxAttempts: MAX_BLOCKS,
      output: tailOf(output),
    }),
  };
}

// Without git there is no telling whether the agent changed code: holding it blindly is worse
// than letting it go with a message.
async function codeChangedOrGitMissing(
  session: StopSession,
  checks: ProjectChecks,
): Promise<boolean | GitError> {
  try {
    return await codeChangedThisTurn(session, checks);
  } catch (err) {
    if (err instanceof GitError) return err;

    throw err;
  }
}

async function verdictOf(session: StopSession): Promise<StopVerdict> {
  const reading = await readConfig(session.root);

  if ("broken" in reading) {
    const message = session.messages.stop.configUnreadable({
      file: PROJECT_CONFIG_FILE,
      reason: reading.broken.message,
    });

    return { kind: "release-with-message", message };
  }

  const checks = reading.config === undefined ? undefined : checksOf(reading.config);

  if (checks === undefined) return RELEASE;

  const changed = await codeChangedOrGitMissing(session, checks);

  if (changed instanceof GitError) {
    const message = session.messages.stop.gitUnavailable(changed.message);

    return { kind: "release-with-message", message };
  }
  if (!changed) return RELEASE;

  const run = runChecks(checks, session.root, session.statePath("checks-output"));

  if (run.passed) return RELEASE;

  return verdictOnRedChecks(session, checks, run.output);
}

// A directory may sit where the state file should be: the agent is let go then too.
async function removeState(file: string): Promise<void> {
  await rm(file, { force: true, recursive: true });
}

// The released agent has finished the turn: the next prompt starts a new one.
async function endTurn(session: StopSession): Promise<void> {
  await removeState(session.statePath("turn-start"));
  await removeState(session.statePath("stop-blocks"));
}

async function outcomeOf(session: StopSession, verdict: StopVerdict): Promise<HookOutcome> {
  switch (verdict.kind) {
    case "release":
      await endTurn(session);

      return SILENT_EXIT;
    case "release-with-message":
      await endTurn(session);

      return {
        exitCode: SUCCESS_EXIT_CODE,
        stdout: `${JSON.stringify({ systemMessage: verdict.message })}\n`,
        stderr: "",
      };
    case "block":
      return {
        exitCode: SUCCESS_EXIT_CODE,
        stdout: `${JSON.stringify({ decision: "block", reason: verdict.message })}\n`,
        stderr: "",
      };
  }
}

/**
 * Decides whether the agent may finish the turn: runs the checks if it changed code.
 * @param {HookContext} context Hook call.
 * @returns {Promise<HookOutcome>} Let go, let go with a message, or send back to work.
 */
export async function gateStop(context: HookContext): Promise<HookOutcome> {
  const sessionId = sessionIdOf(context.payload);
  const session: StopSession = {
    root: context.projectDirectory,
    statePath: (name) => hookStatePath(context.tmpDir, sessionId, name),
    messages: context.messages,
  };

  return outcomeOf(session, await verdictOf(session));
}
