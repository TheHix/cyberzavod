import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { confirmWithoutAsking, terminalConfirmation } from "./confirmation.ts";

const QUESTION = "Продолжить? [Y/n]";

async function answerOf(input: string | undefined): Promise<boolean> {
  const stream = new PassThrough();
  const confirmation = terminalConfirmation({ input: stream, output: new PassThrough() });

  if (input === undefined) stream.end();
  else stream.end(input);

  return confirmation(QUESTION);
}

describe("terminalConfirmation", () => {
  it.each(["\n", "y\n", "Y\n", "yes\n", "да\n", "Да\n", "  д  \n"])(
    "принимает ответ %j как согласие",
    async (input) => {
      const isConfirmed = await answerOf(input);

      expect(isConfirmed).toBe(true);
    },
  );

  it.each(["n\n", "нет\n", "maybe\n", "no\n"])("принимает ответ %j как отказ", async (input) => {
    const isConfirmed = await answerOf(input);

    expect(isConfirmed).toBe(false);
  });

  it("на закрытом вводе отказывает", async () => {
    const isConfirmed = await answerOf(undefined);

    expect(isConfirmed).toBe(false);
  });

  it("пишет вопрос в вывод, а при закрытом вводе переводит строку", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const confirmation = terminalConfirmation({ input, output });

    input.end();
    await confirmation(QUESTION);

    expect(output.read()?.toString()).toBe(`${QUESTION} \n`);
  });
});

describe("confirmWithoutAsking", () => {
  it("соглашается, не спрашивая", async () => {
    const isConfirmed = await confirmWithoutAsking(QUESTION);

    expect(isConfirmed).toBe(true);
  });
});
