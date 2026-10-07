// Точка входа хука записи: читает JSON события Claude Code из stdin и дописывает строку в сырой
// журнал сессии `capture/claude/raw/<session_id>.jsonl` журнала проекта. Запускается асинхронно
// и работу агента не тормозит. Проект без маркера Cyberzavod не записывается.

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
import {
  captureDirectories,
  claimHumanCallMarker,
  locateProject,
  TMP_DIR,
  type LocatedProject,
} from "../paths.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// Хук не должен падать из-за конфига: битый конфиг — предупреждение, сессия не пишется.
async function sessionProject(): Promise<LocatedProject | undefined> {
  try {
    return await locateProject(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  } catch (err) {
    if (!(err instanceof ProjectFileError)) throw err;
    console.warn(`сессия не записана: ${err.message}`);
    return undefined;
  }
}

function withProject(event: RawEvent, project: LocatedProject): RawEvent {
  return event.kind === "session_start" ? stampProject(event, project.config) : event;
}

// Отметку оставляет хук остановки, когда сдался; забирает её промпт человека. Служебное
// сообщение среды отметку не забирает: человек в нём не говорит.
async function withStopGateMark(event: RawEvent, sessionId: string): Promise<RawEvent> {
  if (event.kind !== "prompt" || !isHumanPrompt(event.text)) return event;
  return (await claimHumanCallMarker(sessionId, TMP_DIR)) ? markAfterStopGate(event) : event;
}

const payload: unknown = JSON.parse(await readStdin());
const hookEvent = fromHookPayload(payload, Date.now());
const project = hookEvent === null ? undefined : await sessionProject();

if (hookEvent !== null && project !== undefined) {
  const sessionId = (payload as { session_id?: unknown }).session_id;
  if (!isSafeSessionId(sessionId)) throw new Error(`недопустимый session_id: ${String(sessionId)}`);
  const recorded = await withStopGateMark(withProject(hookEvent, project), sessionId);
  const { raw } = captureDirectories(project.journal);
  await mkdir(raw, { recursive: true });
  await appendFile(path.join(raw, `${sessionId}.jsonl`), `${JSON.stringify(recorded)}\n`);
}
