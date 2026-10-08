// Единственный вопрос `init`: «Продолжить?». Отвечает человек в терминале или заготовка без
// вопроса — для `--yes`, CI и облака, где терминала нет.

import { createInterface } from "node:readline";

/** Потоки, через которые CLI говорит с человеком. */
export interface TerminalStreams {
  /** Откуда читать ответ. */
  input: NodeJS.ReadableStream;
  /** Куда писать вопрос. */
  output: NodeJS.WritableStream;
}

/**
 * Задаёт вопрос «да или нет» и возвращает согласие.
 * @param {string} question Вопрос.
 * @returns {Promise<boolean>} Согласился ли человек.
 */
export type Confirmation = (question: string) => Promise<boolean>;

/** Ответы, которые считаются согласием: пустая строка — это Enter на значении по умолчанию. */
const ACCEPTED_ANSWERS: readonly string[] = ["", "y", "yes", "д", "да"];

function isAccepted(answer: string): boolean {
  return ACCEPTED_ANSWERS.includes(answer.trim().toLowerCase());
}

/**
 * Спрашивает человека в терминале и читает одну строку. Согласие — Enter, `y`, `yes`, `д`, `да`;
 * любой другой ответ и конец ввода — отказ.
 * @param {TerminalStreams} streams Ввод и вывод.
 * @returns {Confirmation} Вопрос на заданных потоках.
 */
export function terminalConfirmation(streams: TerminalStreams): Confirmation {
  return async (question) => {
    const terminal = createInterface({ input: streams.input });
    const lines = terminal[Symbol.asyncIterator]();

    try {
      streams.output.write(`${question} `);

      const line = await lines.next();

      // Без ввода терминал не перевёл строку за человека: следующий вывод ушёл бы в эту же.
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
 * Соглашается, ничего не спрашивая: `init --yes` и запуск без терминала.
 * @returns {Promise<boolean>} Всегда согласие.
 */
export const confirmWithoutAsking: Confirmation = () => Promise.resolve(true);
