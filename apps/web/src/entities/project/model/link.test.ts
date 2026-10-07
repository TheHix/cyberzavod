import { describe, expect, it } from "vitest";
import { projectLinkOf } from "./link.ts";
import type { PublishedProject } from "./published.ts";

function validProject(): PublishedProject {
  return {
    id: "demo",
    name: { en: "Demo", ru: "Демо" },
    description: { en: "An example project", ru: "Пример проекта" },
  };
}

describe("projectLinkOf", () => {
  it.each([
    ["en", "Demo", "/projects/demo/"],
    ["ru", "Демо", "/ru/projects/demo/"],
  ] as const)("ведёт на страницу проекта на языке %s", (locale, name, url) => {
    const project = validProject();

    const link = projectLinkOf(project, locale);

    expect(link).toEqual({ name, url });
  });
});
