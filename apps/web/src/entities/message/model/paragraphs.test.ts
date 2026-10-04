import { describe, expect, it } from "vitest";
import { paragraphsOf } from "./paragraphs.ts";

describe("paragraphsOf", () => {
  it("делит текст по пустым строкам", () => {
    const paragraphs = paragraphsOf("Первый абзац.\n\nВторой абзац.\n \n\nТретий.");

    expect(paragraphs).toEqual(["Первый абзац.", "Второй абзац.", "Третий."]);
  });

  it("оставляет перевод строки внутри абзаца", () => {
    const paragraphs = paragraphsOf("Строка раз\nстрока два");

    expect(paragraphs).toEqual(["Строка раз\nстрока два"]);
  });

  it("не отдаёт пустых абзацев", () => {
    const paragraphs = paragraphsOf("\n\n  \n\nТекст\n\n");

    expect(paragraphs).toEqual(["Текст"]);
  });
});
