// The only question of `init`: "Continue?". Answered by the human in a terminal or by a preset
// without asking, for `--yes`, CI and the cloud, where there is no terminal.

import { createInterface } from "node:readline";

/** Streams through which the CLI talks to the human. */
export interface TerminalStreams {
  /** Where to read the answer from. */
  input: NodeJS.ReadableStream;
  /** Where to write the question. */
  output: NodeJS.WritableStream;
}

/**
 * Asks a yes-or-no question and returns consent.
 * @param {string} question The question.
 * @returns {Promise<boolean>} Whether the human agreed.
 */
export type Confirmation = (question: string) => Promise<boolean>;

/** Answers that count as consent: an empty string is Enter on the default value. */
const ACCEPTED_ANSWERS: readonly string[] = ["", "y", "yes", "д", "да"];

function isAccepted(answer: string): boolean {
  return ACCEPTED_ANSWERS.includes(answer.trim().toLowerCase());
}

/**
 * Asks the human in the terminal and reads one line. Consent is Enter, `y`, `yes`, `д`, `да`;
 * any other answer and end of input are a refusal.
 * @param {TerminalStreams} streams Input and output.
 * @returns {Confirmation} The question on the given streams.
 */
export function terminalConfirmation(streams: TerminalStreams): Confirmation {
  return async (question) => {
    const terminal = createInterface({ input: streams.input });
    const lines = terminal[Symbol.asyncIterator]();

    try {
      streams.output.write(`${question} `);

      const line = await lines.next();

      // Without input the terminal did not break the line for the human: the next output would land
      // on the same one.
      if (line.done === true) {
        streams.output.write("\n");

        return false;
      }

      return isAccepted(line.value);
    } finally {
      terminal.close();
    }
  };
}

/**
 * Agrees without asking anything: `init --yes` and running without a terminal.
 * @returns {Promise<boolean>} Always consent.
 */
export const confirmWithoutAsking: Confirmation = () => Promise.resolve(true);
