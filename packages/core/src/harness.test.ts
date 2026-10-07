import { describe, expect, it } from "vitest";
import { HarnessError, parseStageGuide } from "./harness.ts";

function stageFile(header: string, body = "Текст этапа."): string {
  return `---\n${header}\n---\n\n${body}\n`;
}

function roleHeader(): string {
  return "role: analyst\ntitle: Постановка\ndescription: Ставит задачу.\naccess: read";
}

describe("parseStageGuide", () => {
  it("читает шапку с ролью и текст этапа", () => {
    const text = stageFile(roleHeader());

    const guide = parseStageGuide("planning", text);

    expect(guide).toEqual({
      stage: "planning",
      title: "Постановка",
      description: "Ставит задачу.",
      role: { name: "analyst", access: "read" },
      body: "Текст этапа.",
    });
  });

  it("читает этап без роли", () => {
    const text = stageFile("title: Фиксация\ndescription: Фиксирует работу.");

    const guide = parseStageGuide("record", text);

    expect(guide.role).toBeUndefined();
  });

  it("читает файл с переводами строк Windows", () => {
    const text = stageFile(roleHeader()).replace(/\n/g, "\r\n");

    const guide = parseStageGuide("planning", text);

    expect(guide.body).toBe("Текст этапа.");
  });

  it("отклоняет файл без шапки", () => {
    const act = () => parseStageGuide("planning", "Просто текст.");

    expect(act).toThrow(HarnessError);
  });

  it("отклоняет шапку без описания", () => {
    const act = () => parseStageGuide("record", stageFile("title: Фиксация"));

    expect(act).toThrow(/title и description/);
  });

  it("отклоняет роль без доступа", () => {
    const text = stageFile("role: coder\ntitle: Код\ndescription: Пишет код.");

    const act = () => parseStageGuide("implementation", text);

    expect(act).toThrow(/access/);
  });

  it("отклоняет имя роли не латиницей", () => {
    const text = stageFile("role: Кодер\ntitle: Код\ndescription: Пишет код.\naccess: write");

    const act = () => parseStageGuide("implementation", text);

    expect(act).toThrow(/role/);
  });

  it("отклоняет строку шапки, которая не поле", () => {
    const text = stageFile("title: Код\nэто не поле\ndescription: Пишет код.");

    const act = () => parseStageGuide("implementation", text);

    expect(act).toThrow(/не поле/);
  });
});
