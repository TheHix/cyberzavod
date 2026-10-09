// Capture hook: appends a Claude Code event as a line to the session's raw log
// `capture/claude/raw/<session_id>.jsonl` in the project journal. It runs asynchronously and does
// not slow the agent down. A project without the Cyberzavod marker is not captured.

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ProjectFileError } from "@cyberzavod/storage";
import { isHumanPrompt } from "../capture/to-draft.ts";
import {
  fromHookPayload,
  isSafeSessionId,
  markAfterStopGate,
  stampProject,
  type RawEvent,
} from "../capture/raw-event.ts";
import { captureDirectories, locateProject, type LocatedProject } from "../paths.ts";
import { SILENT_EXIT, type HookContext, type HookOutcome } from "./hook.ts";
import { claimHumanCallMarker } from "./state.ts";

/** Capture error: the hook payload is not fit for a log file name. */
export class RecordHookError extends Error {}

function withProject(event: RawEvent, project: LocatedProject): RawEvent {
  return event.kind === "session_start" ? stampProject(event, project.config) : event;
}

// The stop hook leaves the marker when it gives up; the human's prompt claims it. A service
// message from the environment does not claim the marker: the human does not speak in it.
async function withStopGateMark(
  event: RawEvent,
  sessionId: string,
  context: HookContext,
): Promise<RawEvent> {
  if (event.kind !== "prompt" || !isHumanPrompt(event.text)) return event;

  const isClaimed = await claimHumanCallMarker(sessionId, context.tmpDir, context.messages);

  return isClaimed ? markAfterStopGate(event) : event;
}

/**
 * Writes a session event to the project's raw log. A broken config does not crash the hook: the
 * session is not captured, and the hook warns.
 * @param {HookContext} context Hook call.
 * @returns {Promise<HookOutcome>} A silent exit or a warning on stderr.
 * @throws {RecordHookError} If `session_id` is not fit for a file name.
 */
export async function recordEvent(context: HookContext): Promise<HookOutcome> {
  const payload: unknown = JSON.parse(context.payload);
  const hookEvent = fromHookPayload(payload, Date.now());

  if (hookEvent === null) return SILENT_EXIT;

  let project: LocatedProject | undefined;

  try {
    project = await locateProject(context.projectDirectory);
  } catch (err) {
    if (!(err instanceof ProjectFileError)) throw err;

    const reason = context.messages.record.sessionNotRecorded(err.message);

    return { ...SILENT_EXIT, stderr: `${reason}\n` };
  }

  if (project === undefined) return SILENT_EXIT;

  const sessionId = (payload as { session_id?: unknown }).session_id;

  if (!isSafeSessionId(sessionId)) {
    throw new RecordHookError(`invalid session_id: ${String(sessionId)}`);
  }

  const stampedEvent = withProject(hookEvent, project);
  const event = await withStopGateMark(stampedEvent, sessionId, context);
  const { raw } = captureDirectories(project.journal);

  await mkdir(raw, { recursive: true });
  await appendFile(path.join(raw, `${sessionId}.jsonl`), `${JSON.stringify(event)}\n`);

  return SILENT_EXIT;
}
