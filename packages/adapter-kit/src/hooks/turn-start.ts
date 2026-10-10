// UserPromptSubmit hook: starts a turn by saving the code fingerprint and resetting the stop hook's
// refusal counter. The fingerprint tells the stop hook whether the agent changed code in this turn.
// With no project config, no check commands, or a broken config, the hook saves nothing: in those
// cases the stop hook lets the agent go without checks.
//
// A turn starts only if there is no fingerprint yet: subagent reports mid-work arrive as the same
// event and must not move the start of the turn. The stop hook deletes the fingerprint when it
// lets the agent go. If a turn was interrupted (Stop not called), the next turn inherits both the
// start of the interrupted turn and its counter: the check gets stricter and fewer than three
// attempts may remain. There is no infinite loop.

import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { ProjectFileError, readProjectConfig } from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { checksOf } from "./checks.ts";
import { codeFingerprint, type GitError } from "./fingerprint.ts";
import { sessionIdOf, SILENT_EXIT, type HookContext, type HookOutcome } from "./hook.ts";
import { hookStatePath } from "./state.ts";

// A broken config is no reason to make noise here: the stop hook reports it.
async function configOrNothing(root: string): Promise<ProjectConfig | undefined> {
  try {
    return await readProjectConfig(root);
  } catch (err) {
    if (err instanceof ProjectFileError) return undefined;

    throw err;
  }
}

/**
 * Starts a turn: saves the code fingerprint if the turn has not started yet.
 * @param {HookContext} context Hook call.
 * @returns {Promise<HookOutcome>} Always a silent exit.
 * @throws {GitError} If git does not start.
 */
export async function startTurn(context: HookContext): Promise<HookOutcome> {
  const config = await configOrNothing(context.projectDirectory);
  const checks = config === undefined ? undefined : checksOf(config);

  if (checks === undefined) return SILENT_EXIT;

  const sessionId = sessionIdOf(context.payload);
  const turnStart = hookStatePath(context.tmpDir, sessionId, "turn-start");

  if (existsSync(turnStart)) return SILENT_EXIT;

  await rm(hookStatePath(context.tmpDir, sessionId, "stop-blocks"), { force: true });
  await writeFile(turnStart, codeFingerprint(context.projectDirectory, checks.paths));

  return SILENT_EXIT;
}
