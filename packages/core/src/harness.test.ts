import { describe, expect, it } from "vitest";
import { HarnessError, parseHarness, parseStageGuide, type HarnessFiles } from "./harness.ts";
import { STAGES } from "./stage.ts";

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

function harnessFiles(): Record<string, string> {
  const stages = Object.fromEntries(
    STAGES.map((stage) => [
      `stages/${stage}.md`,
      stageFile(`title: Этап ${stage}\ndescription: Делает ${stage}.`),
    ]),
  );
  return {
    ...stages,
    "principles/safety.md": "## Безопасность\n",
    "principles/architecture.md": "## Архитектура\n",
    "workflows/default.json": JSON.stringify({ name: "default", stages: [...STAGES] }),
    "conductor.md": "Ведущий.\n",
  };
}

describe("parseHarness", () => {
  it("собирает принципы по имени файла, этапы, процессы и правила ведущего", () => {
    const files: HarnessFiles = harnessFiles();

    const harness = parseHarness(files);

    expect({
      principles: harness.principles,
      stages: Object.keys(harness.stages),
      workflows: harness.workflows.map(({ name }) => name),
      conductor: harness.conductor,
    }).toEqual({
      principles: [
        { name: "architecture", text: "## Архитектура" },
        { name: "safety", text: "## Безопасность" },
      ],
      stages: [...STAGES],
      workflows: ["default"],
      conductor: "Ведущий.",
    });
  });

  it("отклоняет harness без файла этапа", () => {
    const files = harnessFiles();
    delete files["stages/review.md"];

    const act = () => parseHarness(files);

    expect(act).toThrow(HarnessError);
  });

  it("отклоняет процесс, имя которого не совпадает с именем файла", () => {
    const files = {
      ...harnessFiles(),
      "workflows/short.json": JSON.stringify({ name: "long", stages: ["implementation"] }),
    };

    const act = () => parseHarness(files);

    expect(act).toThrow(/short/);
  });

  it("не берёт файлы из вложенных каталогов", () => {
    const files = { ...harnessFiles(), "principles/drafts/old.md": "## Старое" };

    const harness = parseHarness(files);

    expect(harness.principles.map(({ name }) => name)).toEqual(["architecture", "safety"]);
  });
});
