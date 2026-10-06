import { describe, expect, it } from "vitest";
import type { Project } from "@cyberzavod/core";
import { projectLinkOf } from "./link.ts";

function validProject(): Project {
  return { id: "demo", name: "Демо", description: "Пример проекта" };
}

describe("projectLinkOf", () => {
  it.each([
    ["en", "/projects/demo/"],
    ["ru", "/ru/projects/demo/"],
  ] as const)("ведёт на страницу проекта на языке %s", (locale, expected) => {
    const project = validProject();

    const link = projectLinkOf(project, locale);

    expect(link).toEqual({ name: "Демо", url: expected });
  });
});
