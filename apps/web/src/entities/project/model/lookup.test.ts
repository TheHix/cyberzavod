import { describe, expect, it } from "vitest";
import { projectOf, UnknownProjectError } from "./lookup.ts";
import type { PublishedProject } from "./published.ts";

function projectWith(id: string): PublishedProject {
  return {
    id,
    name: { en: `Project ${id}`, ru: `Проект ${id}` },
    description: { en: "Description", ru: "Описание" },
  };
}

describe("projectOf", () => {
  it("находит карточку по id", () => {
    const projects = [projectWith("first"), projectWith("second")];

    const project = projectOf(projects, "second");

    expect(project.id).toBe("second");
  });

  it("бросает UnknownProjectError, если карточки нет", () => {
    const projects = [projectWith("first")];

    const act = () => projectOf(projects, "missing");

    expect(act).toThrow(UnknownProjectError);
    expect(act).toThrow("у проекта missing нет карточки в projects/");
  });
});
