import { describe, expect, it } from "vitest";
import { parseProject, ProjectError } from "./project.ts";

// Карточка как сырой JSON: тесты портят её как угодно, проверяет parseProject.
function validProject(): Record<string, unknown> {
  return {
    id: "cyberzavod",
    name: "Киберзавод",
    description: "Цех, в котором ИИ-агенты собирают продукты.",
  };
}

describe("parseProject", () => {
  it("принимает карточку без ссылок", () => {
    const raw = validProject();

    const project = parseProject(raw);

    expect(project).toEqual(raw);
  });

  it("возвращает repo и website", () => {
    const raw = {
      ...validProject(),
      repo: "https://github.com/TheHix/cyberzavod",
      website: "https://cyberzavod.com",
    };

    const project = parseProject(raw);

    expect(project.repo).toBe("https://github.com/TheHix/cyberzavod");
    expect(project.website).toBe("https://cyberzavod.com");
  });

  it("не добавляет отсутствующие ссылки и отбрасывает неизвестные поля", () => {
    const raw = { ...validProject(), license: "MIT" };

    const project = parseProject(raw);

    expect(Object.keys(project).sort()).toEqual(["description", "id", "name"]);
  });

  it("отклоняет не объект", () => {
    const act = () => parseProject("cyberzavod");

    expect(act).toThrow(ProjectError);
  });

  it("отклоняет id с недопустимыми символами", () => {
    const raw = { ...validProject(), id: "../etc" };

    const act = () => parseProject(raw);

    expect(act).toThrow(/id/);
  });

  it("отклоняет пустое name", () => {
    const raw = { ...validProject(), name: "  " };

    const act = () => parseProject(raw);

    expect(act).toThrow(/name/);
  });

  it("отклоняет description с переводом строки", () => {
    const raw = { ...validProject(), description: "Первая\nвторая" };

    const act = () => parseProject(raw);

    expect(act).toThrow(/description/);
  });

  it("отклоняет ссылку http://", () => {
    const raw = { ...validProject(), repo: "http://github.com/TheHix/cyberzavod" };

    const act = () => parseProject(raw);

    expect(act).toThrow(/repo/);
  });

  it("отклоняет не-адрес в website", () => {
    const raw = { ...validProject(), website: "не адрес" };

    const act = () => parseProject(raw);

    expect(act).toThrow(ProjectError);
    expect(act).toThrow(/website/);
  });
});
