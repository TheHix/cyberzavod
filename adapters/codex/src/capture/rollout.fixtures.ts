// Rollouts as Codex 0.162.1 writes them. The ones marked "live" were captured from a real
// `codex exec` run with a mock model; the developer instructions, the tool catalog, the world state
// and the sandbox details are left out, everything else (ids, times, order, the fields the parser
// reads) is as written. The ones marked "documented" are built from the shape Codex's source gives,
// because the run did not produce them.

import { SESSION_ID, SUBAGENT_ID } from "./hook-payload.fixtures.ts";

const SESSION_TURN_ID = "01a124f1-d8b2-7b81-9836-214836be2e83";
const SUBAGENT_TURN_ID = "01a124f1-d9b7-7341-bac0-66e50410e105";
const MODEL = "gpt-5.5";

/** Start of the live run's main session in milliseconds, the time of its first rollout line. */
export const SESSION_START_MS = Date.parse("2026-10-10T08:33:11.885Z");

interface RolloutLine {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * One rollout line.
 * @param {string} timestamp Time of the line, ISO.
 * @param {string} type Line kind.
 * @param {Record<string, unknown>} payload The line's content.
 * @returns {RolloutLine} The line.
 */
export function line(
  timestamp: string,
  type: string,
  payload: Record<string, unknown>,
): RolloutLine {
  return { timestamp, type, payload };
}

/**
 * Rollout text: a line of JSON per record.
 * @param {RolloutLine[]} lines Lines of the rollout.
 * @returns {string} The file contents.
 */
export function rolloutOf(lines: readonly RolloutLine[]): string {
  return `${lines.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function tokens(responseId: string, timestamp: string, usage: Record<string, number>) {
  return line(timestamp, "token_usage_record", {
    thread_id: SESSION_ID,
    turn_id: SESSION_TURN_ID,
    session_id: SESSION_ID,
    root_turn_id: SESSION_TURN_ID,
    response_id: responseId,
    usage: { cache_write_input_tokens: 0, reasoning_output_tokens: 0, ...usage },
  });
}

function assistantMessage(timestamp: string, text: string) {
  return line(timestamp, "response_item", {
    type: "message",
    id: "mr4",
    role: "assistant",
    content: [{ type: "output_text", text }],
  });
}

function userMessage(timestamp: string, text: string) {
  return line(timestamp, "response_item", {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }],
  });
}

/**
 * Live: the main session of the run. The human says "do review", the model spawns the `reviewer`
 * role with `spawn_agent` (found through the tool search, in the `multi_agent_v1` namespace), waits
 * and answers "parent done". Four model responses, ten tokens each.
 * @returns {string} The rollout.
 */
export function sessionRollout(): string {
  return rolloutOf([
    line("2026-10-10T08:33:11.885Z", "session_meta", {
      session_id: SESSION_ID,
      id: SESSION_ID,
      timestamp: "2026-10-10T08:33:11.831Z",
      cwd: "/project",
      originator: "codex_exec",
      cli_version: "0.162.1",
      source: "exec",
      thread_source: "user",
    }),
    line("2026-10-10T08:33:11.885Z", "event_msg", {
      type: "task_started",
      turn_id: SESSION_TURN_ID,
    }),
    line("2026-10-10T08:33:11.915Z", "turn_context", {
      turn_id: SESSION_TURN_ID,
      cwd: "/project",
      model: MODEL,
    }),
    userMessage("2026-10-10T08:33:11.967Z", "do review"),
    line("2026-10-10T08:33:11.991Z", "response_item", {
      type: "tool_search_call",
      call_id: "tsr1",
      arguments: { query: "spawn agent subagent" },
    }),
    tokens("r1", "2026-10-10T08:33:11.997Z", {
      input_tokens: 7,
      cached_input_tokens: 0,
      output_tokens: 3,
    }),
    line("2026-10-10T08:33:12.026Z", "response_item", {
      type: "function_call",
      name: "spawn_agent",
      namespace: "multi_agent_v1",
      arguments: '{"message": "review the change", "agent_type": "reviewer"}',
      call_id: "cr2",
    }),
    tokens("r2", "2026-10-10T08:33:12.028Z", {
      input_tokens: 7,
      cached_input_tokens: 0,
      output_tokens: 3,
    }),
    line("2026-10-10T08:33:12.180Z", "response_item", {
      type: "function_call_output",
      call_id: "cr2",
      output: `{"agent_id":"${SUBAGENT_ID}","nickname":"Epicurus"}`,
    }),
    line("2026-10-10T08:33:12.224Z", "response_item", {
      type: "function_call",
      name: "wait_agent",
      namespace: "multi_agent_v1",
      arguments: '{"timeout_ms": 30000}',
      call_id: "cr3",
    }),
    tokens("r3", "2026-10-10T08:33:12.226Z", {
      input_tokens: 7,
      cached_input_tokens: 0,
      output_tokens: 3,
    }),
    line("2026-10-10T08:33:12.245Z", "response_item", {
      type: "function_call_output",
      call_id: "cr3",
      output: "agent ids must be non-empty",
    }),
    line("2026-10-10T08:33:12.297Z", "event_msg", {
      type: "item_completed",
      item: { type: "AgentMessage", id: "mr4", content: [{ type: "Text", text: "parent done" }] },
    }),
    assistantMessage("2026-10-10T08:33:12.299Z", "parent done"),
    tokens("r4", "2026-10-10T08:33:12.301Z", {
      input_tokens: 7,
      cached_input_tokens: 0,
      output_tokens: 3,
    }),
    line("2026-10-10T08:33:12.357Z", "event_msg", {
      type: "task_complete",
      turn_id: SESSION_TURN_ID,
      last_agent_message: "parent done",
    }),
  ]);
}

function reviewerStart() {
  return [
    line("2026-10-10T08:33:12.190Z", "session_meta", {
      session_id: SESSION_ID,
      id: SUBAGENT_ID,
      parent_thread_id: SESSION_ID,
      timestamp: "2026-10-10T08:33:12.079Z",
      cwd: "/project",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: SESSION_ID,
            depth: 1,
            agent_nickname: "Epicurus",
            agent_role: "reviewer",
          },
        },
      },
      thread_source: "subagent",
      agent_role: "reviewer",
    }),
    line("2026-10-10T08:33:12.205Z", "turn_context", {
      turn_id: SUBAGENT_TURN_ID,
      cwd: "/project",
      model: MODEL,
    }),
    userMessage("2026-10-10T08:33:12.255Z", "review the change"),
  ];
}

/**
 * Live: the `reviewer` run of the same session. The mock model called a command, and the run was
 * cut off when the parent finished: it has no reply and no end of turn.
 * @returns {string} The rollout.
 */
export function abortedReviewerRollout(): string {
  return rolloutOf([
    ...reviewerStart(),
    line("2026-10-10T08:33:12.297Z", "response_item", {
      type: "function_call",
      name: "exec_command",
      arguments: '{"cmd": "echo child-tool"}',
      call_id: "cr5",
    }),
    line("2026-10-10T08:33:12.298Z", "token_usage_record", {
      thread_id: SUBAGENT_ID,
      turn_id: SUBAGENT_TURN_ID,
      session_id: SESSION_ID,
      response_id: "r5",
      usage: { input_tokens: 7, cached_input_tokens: 0, output_tokens: 3 },
    }),
    line("2026-10-10T08:33:12.373Z", "response_item", {
      type: "function_call_output",
      call_id: "cr5",
      output: "Wall time: 0.1 seconds\naborted by user",
    }),
    userMessage(
      "2026-10-10T08:33:12.383Z",
      "<turn_aborted>\nThe user interrupted the previous turn.\n</turn_aborted>",
    ),
    line("2026-10-10T08:33:12.387Z", "event_msg", { type: "turn_aborted", reason: "interrupted" }),
  ]);
}

// The run's own turn: a reply, the usage of its response and the end of the turn with the report.
function finishedTurn() {
  return [
    assistantMessage("2026-10-10T08:33:12.320Z", "Looking at the diff."),
    line("2026-10-10T08:33:12.330Z", "token_usage_record", {
      thread_id: SUBAGENT_ID,
      turn_id: SUBAGENT_TURN_ID,
      response_id: "r5",
      usage: { input_tokens: 1200, cached_input_tokens: 1000, output_tokens: 50 },
    }),
    line("2026-10-10T08:33:12.340Z", "event_msg", {
      type: "task_complete",
      turn_id: SUBAGENT_TURN_ID,
      last_agent_message: REVIEWER_REPORT,
    }),
  ];
}

/** Verdict and report of the finished `reviewer` run below. */
export const REVIEWER_REPORT = "APPROVED\n\nThe change is small and has a test.";

/**
 * Documented: a `reviewer` run that finished its turn and handed a report to the session.
 * @returns {string} The rollout.
 */
export function finishedReviewerRollout(): string {
  return rolloutOf([...reviewerStart(), ...finishedTurn()]);
}

/**
 * Documented: the session ran two commands. Codex reports a finished command as an
 * `item_completed` line with a `CommandExecution` item, and the model gets the exit code in the
 * output.
 * @returns {string} The rollout.
 */
export function commandsRollout(): string {
  return rolloutOf([
    line("2026-10-10T08:33:11.885Z", "session_meta", { id: SESSION_ID, source: "exec" }),
    line("2026-10-10T08:33:12.100Z", "event_msg", {
      type: "item_completed",
      item: { type: "CommandExecution", id: "call-ok", status: "completed", exit_code: 0 },
    }),
    line("2026-10-10T08:33:12.200Z", "event_msg", {
      type: "item_completed",
      item: { type: "CommandExecution", id: "call-red", status: "completed", exit_code: 1 },
    }),
    line("2026-10-10T08:33:12.300Z", "event_msg", {
      type: "item_completed",
      item: { type: "CommandExecution", id: "call-declined", status: "declined" },
    }),
  ]);
}

/**
 * Documented: the same commands as the model's own output tells of them, without command items.
 * `exec_command` starts with the process header, other shell tools with `Exit code:`.
 * @returns {string} The rollout.
 */
export function outputOnlyRollout(): string {
  return rolloutOf([
    line("2026-10-10T08:33:12.100Z", "response_item", {
      type: "function_call_output",
      call_id: "call-ok",
      output: "Chunk ID: a1\nWall time: 0.0000 seconds\nProcess exited with code 0\nOutput:\nok",
    }),
    line("2026-10-10T08:33:12.200Z", "response_item", {
      type: "function_call_output",
      call_id: "call-red",
      output: "Exit code: 2\nWall time: 1.2 seconds\nOutput:\nProcess exited with code 0",
    }),
    line("2026-10-10T08:33:12.300Z", "response_item", {
      type: "function_call_output",
      call_id: "call-running",
      output: "Wall time: 10.0000 seconds\nProcess running with session ID 7\nOutput:\n",
    }),
  ]);
}

/**
 * Documented: a rollout in the legacy history mode, where the model's messages are `agent_message`
 * events and there are no `response_item` lines.
 * @returns {string} The rollout.
 */
export function legacyRollout(): string {
  return rolloutOf([
    line("2026-10-10T08:33:11.885Z", "session_meta", { id: SESSION_ID, source: "exec" }),
    line("2026-10-10T08:33:11.967Z", "event_msg", { type: "user_message", message: "do review" }),
    line("2026-10-10T08:33:12.299Z", "event_msg", {
      type: "agent_message",
      message: "parent done",
    }),
  ]);
}

/**
 * Documented: a `reviewer` run started with the parent's context (`fork_context`): the rollout
 * begins with copies of the parent's lines, whose records name the parent's thread and turn, and
 * goes on with the run's own turn.
 * @returns {string} The rollout.
 */
export function forkedReviewerRollout(): string {
  return rolloutOf([
    ...reviewerStart(),
    line("2026-10-10T08:33:11.997Z", "token_usage_record", {
      thread_id: SESSION_ID,
      turn_id: SESSION_TURN_ID,
      response_id: "r1",
      usage: { input_tokens: 7, cached_input_tokens: 0, output_tokens: 3 },
    }),
    line("2026-10-10T08:33:12.100Z", "event_msg", {
      type: "task_complete",
      turn_id: SESSION_TURN_ID,
      last_agent_message: "parent's copied report",
    }),
    ...finishedTurn(),
  ]);
}

/**
 * Documented: a `reviewer` run forked in the middle of the parent's turn: the rollout begins with
 * the parent's unfinished text and goes on with the run's own turn, which said nothing and was
 * cut off.
 * @returns {string} The rollout.
 */
export function forkedMidTurnRollout(): string {
  return rolloutOf([
    line("2026-10-10T08:33:12.190Z", "session_meta", {
      session_id: SESSION_ID,
      id: SUBAGENT_ID,
      parent_thread_id: SESSION_ID,
      cwd: "/project",
    }),
    assistantMessage("2026-10-10T08:33:12.200Z", "The parent was still explaining"),
    line("2026-10-10T08:33:12.210Z", "event_msg", {
      type: "task_started",
      turn_id: SUBAGENT_TURN_ID,
    }),
    line("2026-10-10T08:33:12.215Z", "turn_context", {
      turn_id: SUBAGENT_TURN_ID,
      cwd: "/project",
      model: MODEL,
    }),
    userMessage("2026-10-10T08:33:12.255Z", "review the change"),
    line("2026-10-10T08:33:12.298Z", "token_usage_record", {
      thread_id: SUBAGENT_ID,
      turn_id: SUBAGENT_TURN_ID,
      response_id: "r5",
      usage: { input_tokens: 7, cached_input_tokens: 0, output_tokens: 3 },
    }),
  ]);
}
