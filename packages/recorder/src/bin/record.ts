// Точка входа хука: читает JSON события Claude Code из stdin и дописывает строку
// в recordings/raw/<session_id>.jsonl. Запускается асинхронно и работу агента не тормозит.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseProjectConfig, type ProjectConfig } from "../project.ts";
import { fromHookPayload, isSafeSessionId, stampProject, type RawEvent } from "../raw-event.ts";
import { isNotFound, PROJECT_CONFIG_PATH, RECORDINGS_DIRS } from "./paths.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// Хук не должен падать из-за конфига: без него сессия пишется без проекта, а причина
// остаётся предупреждением.
async function readProjectConfig(): Promise<ProjectConfig | undefined> {
  try {
    return parseProjectConfig(JSON.parse(await readFile(PROJECT_CONFIG_PATH, "utf8")));
  } catch (err) {
    if (!isNotFound(err)) {
      console.warn(`конфиг проекта ${PROJECT_CONFIG_PATH} не прочитан: ${String(err)}`);
    }
    return undefined;
  }
}

async function withProject(event: RawEvent): Promise<RawEvent> {
  if (event.kind !== "session_start") return event;
  const project = await readProjectConfig();
  return project === undefined ? event : stampProject(event, project);
}

const payload: unknown = JSON.parse(await readStdin());
const hookEvent = fromHookPayload(payload, Date.now());
const event = hookEvent === null ? null : await withProject(hookEvent);

if (event !== null) {
  const sessionId = (payload as { session_id?: unknown }).session_id;
  if (!isSafeSessionId(sessionId)) throw new Error(`недопустимый session_id: ${String(sessionId)}`);
  await mkdir(RECORDINGS_DIRS.raw, { recursive: true });
  await appendFile(
    path.join(RECORDINGS_DIRS.raw, `${sessionId}.jsonl`),
    `${JSON.stringify(event)}\n`,
  );
}
