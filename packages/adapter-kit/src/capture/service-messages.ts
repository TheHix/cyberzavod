// The agent environment delivers subagent reports, notifications and its own reminders with the
// same event as the human's messages. These openings tell them apart: the recording has only the
// human's prompts.

const SERVICE_MESSAGE_PREFIXES: readonly string[] = [
  // Claude Code
  "[Subagent hand-back]",
  "[SYSTEM NOTIFICATION",
  "<task-notification>",
  "<agent-message",
  "<system-reminder>",
  // Codex: the stop hook's reason handed back as a user message, and the mark of an interrupted turn
  "<hook_prompt",
  "<turn_aborted>",
];

/**
 * Tells a human message from an agent environment service message.
 * @param {string} text UserPromptSubmit event text.
 * @returns {boolean} true if the message was written by a human.
 */
export function isHumanPrompt(text: string): boolean {
  const start = text.trimStart();

  return !SERVICE_MESSAGE_PREFIXES.some((prefix) => start.startsWith(prefix));
}
