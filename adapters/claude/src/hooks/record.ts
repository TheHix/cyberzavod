// Хук записи: дописывает событие Claude Code строкой в сырой журнал сессии
// `capture/claude/raw/<session_id>.jsonl` журнала проекта. Запускается асинхронно и работу агента
// не тормозит. Проект без маркера Cyberzavod не записывается.

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

/** Ошибка записи: полезная нагрузка хука не годится для имени журнала. */
export class RecordHookError extends Error {}

function withProject(event: RawEvent, project: LocatedProject): RawEvent {
  return event.kind === "session_start" ? stampProject(event, project.config) : event;
}

// Отметку оставляет хук остановки, когда сдался; забирает её промпт человека. Служебное
// сообщение среды отметку не забирает: человек в нём не говорит.
async function withStopGateMark(
  event: RawEvent,
  sessionId: string,
  tmpDir: string,
): Promise<RawEvent> {
  if (event.kind !== "prompt" || !isHumanPrompt(event.text)) return event;

  return (await claimHumanCallMarker(sessionId, tmpDir)) ? markAfterStopGate(event) : event;
}

/**
 * Записывает событие сессии в сырой журнал проекта. Битый конфиг не роняет хук: сессия не
 * пишется, а хук предупреждает.
 * @param {HookContext} context Вызов хука.
 * @returns {Promise<HookOutcome>} Молчаливый выход или предупреждение в stderr.
 * @throws {RecordHookError} Если `session_id` не годится для имени файла.
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

    return { ...SILENT_EXIT, stderr: `сессия не записана: ${err.message}\n` };
  }

  if (project === undefined) return SILENT_EXIT;

  const sessionId = (payload as { session_id?: unknown }).session_id;

  if (!isSafeSessionId(sessionId)) {
    throw new RecordHookError(`недопустимый session_id: ${String(sessionId)}`);
  }

  const stampedEvent = withProject(hookEvent, project);
  const event = await withStopGateMark(stampedEvent, sessionId, context.tmpDir);
  const { raw } = captureDirectories(project.journal);

  await mkdir(raw, { recursive: true });
  await appendFile(path.join(raw, `${sessionId}.jsonl`), `${JSON.stringify(event)}\n`);

  return SILENT_EXIT;
}
