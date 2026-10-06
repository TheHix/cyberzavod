import { describe, expect, it } from "vitest";
import { GuideError, guideIdOf, parseGuideMeta } from "./guide.ts";

function validFrontmatter(): Record<string, unknown> {
  return {
    title: "Подключить свой проект",
    description: "Как подключить проект к заводу",
    order: 1,
  };
}

describe("parseGuideMeta", () => {
  it("принимает корректный frontmatter", () => {
    const frontmatter = validFrontmatter();

    const meta = parseGuideMeta("connect-project", frontmatter);

    expect(meta).toEqual({ id: "connect-project", ...frontmatter });
  });

  it("отбрасывает неизвестные поля", () => {
    const frontmatter = { ...validFrontmatter(), file: "/guides/a.md", draft: true };

    const meta = parseGuideMeta("a", frontmatter);

    expect(Object.keys(meta).sort()).toEqual(["description", "id", "order", "title"]);
  });

  it.each([0, -1])("принимает order %i", (order) => {
    const frontmatter = { ...validFrontmatter(), order };

    const meta = parseGuideMeta("a", frontmatter);

    expect(meta.order).toBe(order);
  });

  it.each([
    ["пустой title", { title: "  " }, "title"],
    ["title не строка", { title: 5 }, "title"],
    ["нет title", { title: undefined }, "title"],
    ["title с переводом строки", { title: "Две\nстроки" }, "title"],
    ["пустой description", { description: "" }, "description"],
    ["description с переводом строки", { description: "Две\nстроки" }, "description"],
    ["order строкой", { order: "1" }, "order"],
    ["дробный order", { order: 1.5 }, "order"],
    ["нет order", { order: undefined }, "order"],
  ])("отклоняет %s", (_case, override, field) => {
    const frontmatter = { ...validFrontmatter(), ...override };

    const act = () => parseGuideMeta("a", frontmatter);

    expect(act).toThrow(GuideError);
    expect(act).toThrow(field);
  });

  it.each([
    ["не объект", "текст"],
    ["null", null],
    ["undefined", undefined],
  ])("отклоняет frontmatter: %s", (_case, frontmatter) => {
    const act = () => parseGuideMeta("a", frontmatter);

    expect(act).toThrow(GuideError);
  });
});

describe("guideIdOf", () => {
  it("берёт имя файла без .md из абсолютного пути", () => {
    const file = "/src/guides/connect-project.md";

    const id = guideIdOf(file);

    expect(id).toBe("connect-project");
  });

  it("принимает имя из цифр и одного слова", () => {
    const id = guideIdOf("/src/guides/2fa.md");

    expect(id).toBe("2fa");
  });

  it.each([
    ["с заглавными буквами", "/src/guides/Connect-Project.md"],
    ["с пробелом", "/src/guides/two words.md"],
    ["с подчёркиванием", "/src/guides/connect_project.md"],
    ["с дефисом в конце", "/src/guides/connect-.md"],
    ["без имени", "/src/guides/.md"],
    ["не Markdown", "/src/guides/connect-project.txt"],
  ])("отклоняет имя %s", (_case, file) => {
    const act = () => guideIdOf(file);

    expect(act).toThrow(GuideError);
  });
});
