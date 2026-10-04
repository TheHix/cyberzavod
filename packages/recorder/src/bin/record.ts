// Точка входа хука: читает JSON события Claude Code из stdin и дописывает строку
// в recordings/raw/<session_id>.jsonl. Запускается асинхронно и работу агента не тормозит.

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fromHookPayload, isSafeSessionId } from "../raw-event.ts";
import { RECORDINGS_DIRS } from "./paths.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const payload: unknown = JSON.parse(await readStdin());
const event = fromHookPayload(payload, Date.now());

if (event !== null) {
  const sessionId = (payload as { session_id?: unknown }).session_id;
  if (!isSafeSessionId(sessionId)) throw new Error(`недопустимый session_id: ${String(sessionId)}`);
  await mkdir(RECORDINGS_DIRS.raw, { recursive: true });
  await appendFile(
    path.join(RECORDINGS_DIRS.raw, `${sessionId}.jsonl`),
    `${JSON.stringify(event)}\n`,
  );
}
