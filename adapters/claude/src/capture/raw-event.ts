// Build raw log: a compact event for each Claude Code hook.
// Only what the recording needs is taken from the hook payload, without the contents
// of files and tool responses, so nothing extra gets into the log.

import type { ProjectConfig } from "@cyberzavod/core";

/** A build raw log event; `ts` is the machine clock time in milliseconds. */
export type RawEvent =
  | {
      ts: number;
      kind: "session_start";
      /** Project id from `.cyberzavod/project.json`; comes with `harness` and `workflow`. */
      project?: string;
      /** Harness version from `.cyberzavod/project.json`; comes together with `project`. */
      harness?: string;
      /** Development workflow from `.cyberzavod/project.json`; comes together with `project`. */
      workflow?: string;
    }
  | {
      ts: number;
      kind: "prompt";
      text: string;
      /**
       * The stop hook gave up before this prompt and called the human: the prompt is a call by
       * the stop hook. Set by `markAfterStopGate` when it finds the hook's mark.
       */
      afterStopGate?: true;
    }
  | {
      ts: number;
      kind: "question_answer";
      /** The human's answers to the model's questions as "question — answer" lines. */
      text: string;
      agentId?: string;
    }
  | {
      ts: number;
      kind: "tool";
      tool: string;
      ok: boolean;
      command?: string;
      file?: string;
      /** Directory the session or subagent was in when the tool was called. */
      cwd?: string;
      /** Subagent that called the tool; a main session call has no such field. */
      agentId?: string;
    }
  | { ts: number; kind: "subagent_start"; agent: string; agentId?: string }
  | {
      ts: number;
      kind: "subagent_stop";
      agent: string;
      agentId?: string;
      transcriptPath?: string;
      /** First line of the subagent's reply: for /feature pipeline stations it is the verdict. */
      verdict?: string;
    }
  | { ts: number; kind: "subagent_report"; agentId: string; verdict?: string }
  | { ts: number; kind: "stop"; transcriptPath?: string };

/** A human prompt in the build log. */
export type PromptRawEvent = Extract<RawEvent, { kind: "prompt" }>;

/** A session start in the build log. */
export type SessionStartEvent = Extract<RawEvent, { kind: "session_start" }>;

/** Log format error: a parsed line does not look like an event. */
export class RawLogError extends Error {}

// Bash commands are truncated: the recording needs what was run, not the full text.
const MAX_COMMAND_LENGTH = 200;
const UNKNOWN = "unknown";
// A verdict is a short line like "NEEDS WORK"; a long first line is already the report itself.
const MAX_VERDICT_LENGTH = 40;
// Decoration around a verdict: **APPROVED**, `DEFECT`, # APPROVED, "NEEDS WORK.".
const VERDICT_MARKUP = /[*_`#]/g;
const TRAILING_PUNCTUATION = /[.:!]+$/;
// Claude Code environment marks before a subagent report are in square brackets; they are not a
// verdict.
const HARNESS_NOTE_START = "[";
// In the desktop app a subagent hands back work with the SubagentHandback tool without reply
// text, and the report comes into the session as a message: <agent-message from="<agent_id>">
// [Subagent hand-back] … The report follows: <indented report>.
const SUBAGENT_REPORT = /^<agent-message from="([^"]+)">\s*\[Subagent hand-back\]/;
const REPORT_START = "The report follows:";
// session_id goes into the log file name, so only safe characters are allowed.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// This tool asks the human questions; its answers are the human's text, like a prompt.
const QUESTION_TOOL = "AskUserQuestion";
const ANSWER_SEPARATOR = " — ";

type HookPayload = Record<string, unknown>;

function isPayload(value: unknown): value is HookPayload {
  return typeof value === "object" && value !== null;
}

function stringField(payload: HookPayload, key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

// Subagent tools come in the same session: `agentId` tells a subagent call from
// a main session call, and `cwd` gives the project the command ran in.
function toolEvent(payload: HookPayload, ts: number, ok: boolean): RawEvent {
  const input = isPayload(payload.tool_input) ? payload.tool_input : {};
  const command = stringField(input, "command");

  return withOptional<Extract<RawEvent, { kind: "tool" }>>(
    {
      ts,
      kind: "tool",
      tool: stringField(payload, "tool_name") ?? UNKNOWN,
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
    const answers = isPayload(source) ? source.answers : undefined;

    if (!isPayload(answers)) continue;

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

function withoutVerdictMarkup(line: string): string {
  return line.replace(VERDICT_MARKUP, "").trim().replace(TRAILING_PUNCTUATION, "");
}

// Only the first line of a subagent's reply goes into the log: pipeline stations start
// with the verdict, and the rest of the report is not needed for the recording.
function verdictOf(reply: string | undefined): string | undefined {
  const lines = reply?.split("\n").map(withoutVerdictMarkup);
  const firstLine = lines?.find((line) => line !== "" && !line.startsWith(HARNESS_NOTE_START));

  return firstLine !== undefined && firstLine.length <= MAX_VERDICT_LENGTH ? firstLine : undefined;
}

// Claude Code service subagents come with an empty agent_type.
function agentName(payload: HookPayload): string {
  return stringField(payload, "agent_type") || UNKNOWN;
}

// Optional fields are added only when present, so undefined does not pile up in the log.
// Partial<T>: a typo in a field name does not compile.
function withOptional<T extends object>(event: T, fields: Partial<T>): T {
  const present = Object.entries(fields).filter(([, value]) => value !== undefined);

  return { ...event, ...Object.fromEntries(present) };
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
  if (!isPayload(payload)) return null;

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
        { ts, kind: "subagent_start", agent: agentName(payload) },
        { agentId: stringField(payload, "agent_id") },
      );
    case "SubagentStop":
      return withOptional<Extract<RawEvent, { kind: "subagent_stop" }>>(
        { ts, kind: "subagent_stop", agent: agentName(payload) },
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

/**
 * Tags a session start with the project, harness version and workflow from the project config.
 * @param {SessionStartEvent} event Session start.
 * @param {ProjectConfig} config Config of the project the session runs in.
 * @returns {SessionStartEvent} New event with `project`, `harness` and `workflow`.
 */
export function stampProject(event: SessionStartEvent, config: ProjectConfig): SessionStartEvent {
  return {
    ...event,
    project: config.projectId,
    harness: config.harness,
    workflow: config.workflow,
  };
}

/**
 * Marks a prompt as a call by the stop hook: the hook gave up before it and called the human.
 * @param {PromptRawEvent} event Human prompt.
 * @returns {PromptRawEvent} New prompt with `afterStopGate`.
 */
export function markAfterStopGate(event: PromptRawEvent): PromptRawEvent {
  return { ...event, afterStopGate: true };
}

/**
 * Checks that a session id can be used in the log file name.
 * @param {unknown} value session_id value from the hook payload.
 * @returns {value is string} true if the id can go into the log file name.
 */
export function isSafeSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

// A session start carries the project, harness version and workflow only together, and none without
// a project marker.
function isUnstamped(value: HookPayload): boolean {
  return value.project === undefined && value.harness === undefined && value.workflow === undefined;
}

function isStamped(value: HookPayload): boolean {
  return (
    typeof value.project === "string" &&
    typeof value.harness === "string" &&
    typeof value.workflow === "string"
  );
}

// Required fields check for each event kind. The type requires an entry for each kind:
// a new kind in RawEvent does not compile until its check is described here.
const RAW_EVENT_SHAPES: Record<RawEvent["kind"], (value: HookPayload) => boolean> = {
  session_start: (value) => isUnstamped(value) || isStamped(value),
  prompt: (value) =>
    typeof value.text === "string" &&
    (value.afterStopGate === undefined || value.afterStopGate === true),
  question_answer: (value) => typeof value.text === "string",
  tool: (value) => typeof value.tool === "string" && typeof value.ok === "boolean",
  subagent_start: (value) => typeof value.agent === "string",
  subagent_stop: (value) => typeof value.agent === "string",
  subagent_report: (value) => typeof value.agentId === "string",
  stop: () => true,
};

function isRawEventKind(kind: string): kind is RawEvent["kind"] {
  return Object.hasOwn(RAW_EVENT_SHAPES, kind);
}

function isRawEvent(value: unknown): value is RawEvent {
  if (!isPayload(value) || typeof value.ts !== "number" || typeof value.kind !== "string") {
    return false;
  }

  return isRawEventKind(value.kind) && RAW_EVENT_SHAPES[value.kind](value);
}

/**
 * Reads a build log. A line that does not parse as JSON is a cut-off asynchronous
 * write and is skipped.
 * @param {string} content Log contents in JSONL format.
 * @returns {RawEvent[]} Log events in line order.
 * @throws {RawLogError} If a parsed line is not a log event.
 */
export function parseRawLog(content: string): RawEvent[] {
  const events: RawEvent[] = [];

  content.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;

    let value: unknown;

    try {
      value = JSON.parse(line);
    } catch {
      return;
    }

    if (!isRawEvent(value)) throw new RawLogError(`line ${index + 1}: not a log event`);

    events.push(value);
  });

  return events;
}
