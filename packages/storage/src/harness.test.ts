import path from "node:path";
import { describe, expect, it } from "vitest";
import { STAGES, type Harness } from "@cyberzavod/core";
import { loadHarness, workflowOf } from "./harness.ts";

const REPOSITORY_HARNESS = path.resolve(import.meta.dirname, "../../../harness");

function harnessWith(names: string[]): Harness {
  return {
    principles: [],
    stages: {} as Harness["stages"],
    workflows: names.map((name) => ({ name, stages: ["implementation"] })),
    conductor: "",
  };
}

describe("loadHarness", () => {
  it("читает harness репозитория: процесс по умолчанию идёт по всем этапам по порядку", async () => {
    const harness = await loadHarness(REPOSITORY_HARNESS);

    expect(workflowOf(harness, "default").stages).toEqual([...STAGES]);
  });

  it("читает принципы по имени файла и этап для каждого из STAGES", async () => {
    const harness = await loadHarness(REPOSITORY_HARNESS);

    expect({
      principles: harness.principles.map(({ name }) => name),
      stages: Object.keys(harness.stages),
    }).toEqual({
      principles: ["architecture", "change-scope", "engineering", "safety"],
      stages: [...STAGES],
    });
  });
});

describe("workflowOf", () => {
  it("находит процесс по имени", () => {
    const harness = harnessWith(["default", "short"]);

    const workflow = workflowOf(harness, "short");

    expect(workflow.name).toBe("short");
  });

  it("называет известные процессы, если такого нет", () => {
    const harness = harnessWith(["default", "short"]);

    const act = () => workflowOf(harness, "long");

    expect(act).toThrow("процесса long нет в harness; есть: default, short");
  });
});
