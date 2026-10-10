// What the recording takes from a Claude Code hook payload: the payload becomes a compact raw log
// event, without the contents of files and tool responses.

import {
  isObject,
  MAX_COMMAND_LENGTH,
  stringField,
  subagentNameOf,
  UNKNOWN_NAME,
  verdictOf,
  withOptional,
  type RawEvent,
} from "@cyberzavod/adapter-kit";

// This tool asks the human questions; its answers are the human's text, like a prompt.
const QUESTION_TOOL = "AskUserQuestion";
const ANSWER_SEPARATOR = " — ";
// In the desktop app a subagent hands back work with the SubagentHandback tool without reply
// text, and the report comes into the session as a message: <agent-message from="<agent_id>">
// [Subagent hand-back] … The report follows: <indented report>.
const SUBAGENT_REPORT = /^<agent-message from="([^"]+)">\s*\[Subagent hand-back\]/;
const REPORT_START = "The report follows:";

type HookPayload = Record<string, unknown>;

// Subagent tools come in the same session: `agentId` tells a subagent call from
// a main session call, and `cwd` gives the project the command ran in.
function toolEvent(payload: HookPayload, ts: number, ok: boolean): RawEvent {
  const input = isObject(payload.tool_input) ? payload.tool_input : {};
  const command = stringField(input, "command");

  return withOptional<Extract<RawEvent, { kind: "tool" }>>(
    {
      ts,
      kind: "tool",
      tool: stringField(payload, "tool_name") ?? UNKNOWN_NAME,
      ok,
    },
    {
      command: command?.slice(0, MAX_COMMAND_LENGTH),
      file: stringField(input, "file_path") ?? stringField(input, "notebook_path"),
      cwd: stringField(payload, "cwd"),
      agentId: stringField(payload, "agent_id"),
    },
  );
}

// Answers to questions: a "question → answer" object. The hook docs do not describe the tool
// response format (`answers` is in the input there), so we look in both the response and the input;
// not an object of strings means no answers. Parsing is lenient: extra and unknown parts are
// skipped.
function answersOf(payload: HookPayload): [string, string][] {
  for (const source of [payload.tool_response, payload.tool_input]) {
    const answers = isObject(source) ? source.answers : undefined;

    if (!isObject(answers)) continue;

    const pairs = Object.entries(answers).filter(
      (pair): pair is [string, string] => typeof pair[1] === "string" && pair[1].trim() !== "",
    );

    if (pairs.length > 0) return pairs;
  }

  return [];
}

// An AskUserQuestion call with the human's answers is the human's text, not a tool call. Without
// answers (refusal, cancellation, unknown format) it stays a tool call.
function questionAnswerEvent(payload: HookPayload, ts: number): RawEvent | undefined {
  if (stringField(payload, "tool_name") !== QUESTION_TOOL) return undefined;

  const answers = answersOf(payload);

  if (answers.length === 0) return undefined;

  const text = answers.map(([question, answer]) => `${question}${ANSWER_SEPARATOR}${answer}`);

  return withOptional<Extract<RawEvent, { kind: "question_answer" }>>(
    { ts, kind: "question_answer", text: text.join("\n") },
    { agentId: stringField(payload, "agent_id") },
  );
}

// A subagent report that came into the session as a message is not a human prompt: only the
// agent id and the verdict go from it into the log.
function subagentReport(text: string, ts: number): RawEvent | undefined {
  const agentId = SUBAGENT_REPORT.exec(text)?.[1];

  if (agentId === undefined) return undefined;

  const reportStart = text.indexOf(REPORT_START);
  const report = reportStart === -1 ? undefined : text.slice(reportStart + REPORT_START.length);

  return withOptional<Extract<RawEvent, { kind: "subagent_report" }>>(
    { ts, kind: "subagent_report", agentId },
    { verdict: verdictOf(report) },
  );
}

/**
 * Turns a Claude Code hook payload into a log event.
 * @param {unknown} payload JSON the hook received on stdin.
 * @param {number} ts Event time in milliseconds.
 * @returns {RawEvent | null} Log event, or null if the hook is not needed for the recording.
 */
export function fromHookPayload(payload: unknown, ts: number): RawEvent | null {
  if (!isObject(payload)) return null;

  switch (stringField(payload, "hook_event_name")) {
    case "SessionStart":
      return { ts, kind: "session_start" };

    case "UserPromptSubmit": {
      const text = stringField(payload, "prompt");

      if (text === undefined) return null;

      return subagentReport(text, ts) ?? { ts, kind: "prompt", text };
    }

    case "PostToolUse":
      return questionAnswerEvent(payload, ts) ?? toolEvent(payload, ts, true);
    case "PostToolUseFailure":
      return toolEvent(payload, ts, false);
    case "SubagentStart":
      return withOptional<Extract<RawEvent, { kind: "subagent_start" }>>(
        { ts, kind: "subagent_start", agent: subagentNameOf(payload) },
        { agentId: stringField(payload, "agent_id") },
      );
    case "SubagentStop":
      return withOptional<Extract<RawEvent, { kind: "subagent_stop" }>>(
        { ts, kind: "subagent_stop", agent: subagentNameOf(payload) },
        {
          agentId: stringField(payload, "agent_id"),
          transcriptPath: stringField(payload, "agent_transcript_path"),
          verdict: verdictOf(stringField(payload, "last_assistant_message")),
        },
      );
    case "Stop":
      return withOptional<Extract<RawEvent, { kind: "stop" }>>(
        { ts, kind: "stop" },
        { transcriptPath: stringField(payload, "transcript_path") },
      );
    default:
      return null;
  }
}
