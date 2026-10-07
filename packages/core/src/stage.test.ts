import { describe, expect, it } from "vitest";
import { isStage, parseWorkflow, WorkflowError } from "./stage.ts";

describe("isStage", () => {
  it("узнаёт известный этап и отклоняет прочее", () => {
    const results = ["planning", "record", "spec", 1].map(isStage);

    expect(results).toEqual([true, true, false, false]);
  });
});

describe("parseWorkflow", () => {
  it("принимает процесс с именем и этапами", () => {
    const raw = { name: "short", stages: ["implementation", "verification"], extra: 1 };

    const workflow = parseWorkflow(raw);

    expect(workflow).toEqual({ name: "short", stages: ["implementation", "verification"] });
  });

  it.each([
    ["без имени", { stages: ["planning"] }, /name/],
    ["без этапов", { name: "x", stages: [] }, /stages/],
    ["с неизвестным этапом", { name: "x", stages: ["deploy"] }, /неизвестный этап deploy/],
    ["с повтором этапа", { name: "x", stages: ["planning", "planning"] }, /повторяются/],
  ])("отклоняет процесс %s", (_name, raw, message) => {
    const act = () => parseWorkflow(raw);

    expect(act).toThrow(message);
    expect(act).toThrow(WorkflowError);
  });
});
