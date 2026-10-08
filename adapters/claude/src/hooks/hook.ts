// Общее для хуков Claude Code: что хук получает при вызове и что отдаёт обратно.

import type { ClaudeMessages } from "../messages/claude-messages.ts";

/**
 * Вызов хука: полезная нагрузка события, корень проекта, каталог для состояния между вызовами
 * и тексты на выбранном языке.
 */
export interface HookContext {
  /** JSON события Claude Code со stdin. */
  payload: string;
  projectDirectory: string;
  tmpDir: string;
  messages: ClaudeMessages;
}

/** Ответ хука Claude Code: код выхода и то, что он печатает в stdout и stderr. */
export interface HookOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Обычный выход хука: Claude Code продолжает как ни в чём не бывало. */
export const SILENT_EXIT: HookOutcome = { exitCode: 0, stdout: "", stderr: "" };

const UNKNOWN_SESSION = "unknown";

/**
 * Идентификатор сессии из полезной нагрузки хука.
 * @param {string} payload JSON события Claude Code.
 * @returns {string} `session_id` или `unknown`, если его нет.
 * @throws {SyntaxError} Если полезная нагрузка — не JSON.
 */
export function sessionIdOf(payload: string): string {
  const parsed: unknown = JSON.parse(payload);
  const hasSessionId = typeof parsed === "object" && parsed !== null && "session_id" in parsed;
  const sessionId = hasSessionId ? parsed.session_id : undefined;

  return typeof sessionId === "string" && sessionId !== "" ? sessionId : UNKNOWN_SESSION;
}
