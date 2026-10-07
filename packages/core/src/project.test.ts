import { describe, expect, it } from "vitest";
import { parseProject, ProjectError } from "./project.ts";

// Карточка как сырой JSON: тесты портят её как угодно, проверяет parseProject.
function validProject(): Record<string, unknown> {
  return {
    id: "cyberzavod",
    name: { en: "Cyberzavod", ru: "Киберзавод" },
    description: {
      en: "A factory floor where AI agents build products.",
      ru: "Цех, в котором ИИ-агенты собирают продукты.",
    },
  };
}

const LANGUAGES = ["en", "ru"] as const;

describe("parseProject", () => {
  it("принимает карточку без ссылок", () => {
    const raw = validProject();

    const project = parseProject(raw, LANGUAGES);

    expect(project).toEqual(raw);
  });

  it("возвращает repo и website", () => {
    const raw = {
      ...validProject(),
      repo: "https://github.com/bysavelii/cyberzavod",
      website: "https://cyberzavod.com",
    };

    const project = parseProject(raw, LANGUAGES);

    expect(project.repo).toBe("https://github.com/bysavelii/cyberzavod");
    expect(project.website).toBe("https://cyberzavod.com");
  });

  it("не добавляет отсутствующие ссылки и отбрасывает неизвестные поля", () => {
    const raw = { ...validProject(), license: "MIT" };

    const project = parseProject(raw, LANGUAGES);

    expect(Object.keys(project).sort()).toEqual(["description", "id", "name"]);
  });

  it("отклоняет не объект", () => {
    const act = () => parseProject("cyberzavod", LANGUAGES);

    expect(act).toThrow(ProjectError);
  });

  it("отклоняет id с недопустимыми символами", () => {
    const raw = { ...validProject(), id: "../etc" };

    const act = () => parseProject(raw, LANGUAGES);

    expect(act).toThrow(/id/);
  });

  it("отбрасывает переводы на языки, которых нет у витрины", () => {
    const raw = {
      ...validProject(),
      name: { en: "Cyberzavod", ru: "Киберзавод", de: "Cyberwerk" },
    };

    const project = parseProject(raw, LANGUAGES);

    expect(project.name).toEqual({ en: "Cyberzavod", ru: "Киберзавод" });
  });

  it.each([
    ["name строкой, а не переводами", { name: "Киберзавод" }, /name/],
    ["name без английского", { name: { ru: "Киберзавод" } }, /name на en/],
    ["description без русского", { description: { en: "Factory." } }, /description на ru/],
    ["пустое name", { name: { en: "  ", ru: "Киберзавод" } }, /name на en/],
    ["description с переводом строки", { description: { en: "a\nb", ru: "б" } }, /description/],
  ])("отклоняет карточку: %s", (_case, override, message) => {
    const raw = { ...validProject(), ...override };

    const act = () => parseProject(raw, LANGUAGES);

    expect(act).toThrow(ProjectError);
    expect(act).toThrow(message);
  });

  it("отклоняет ссылку http://", () => {
    const raw = { ...validProject(), repo: "http://github.com/bysavelii/cyberzavod" };

    const act = () => parseProject(raw, LANGUAGES);

    expect(act).toThrow(/repo/);
  });

  it("отклоняет не-адрес в website", () => {
    const raw = { ...validProject(), website: "не адрес" };

    const act = () => parseProject(raw, LANGUAGES);

    expect(act).toThrow(ProjectError);
    expect(act).toThrow(/website/);
  });
});
