import { describe, expect, it } from "vitest";
import { stageModelsOf } from "./stage-models.ts";
import type { BriefSessionEvent, BriefSessionRecord } from "./record.ts";
import type { Stage } from "./stage.ts";

function sessionWith(events: BriefSessionEvent[]): BriefSessionRecord {
  return {
    version: 1,
    type: "session",
    id: "2026-10-07-79fd668f",
    timestamp: "2026-10-07T21:39:18.968Z",
    projectId: "split-bill",
    source: { type: "agent", provider: "anthropic", agent: "claude" },
    data: { title: "Сборка", language: "ru", workflow: "default", harness: "0.0.0", events },
  };
}

function enter(stage: Stage, t: number, model?: string): BriefSessionEvent {
  return model === undefined
    ? { t, type: "stage_enter", stage }
    : { t, type: "stage_enter", stage, model };
}

describe("stageModelsOf", () => {
  it("отдаёт этапы в порядке процесса, а не входов", () => {
    const session = sessionWith([
      enter("review", 10, "claude-opus-5-5"),
      enter("planning", 20, "claude-opus-5-5"),
    ]);

    const stages = stageModelsOf(session).map(({ stage }) => stage);

    expect(stages).toEqual(["planning", "review"]);
  });

  it("не повторяет модель при повторном входе в этап", () => {
    const session = sessionWith([
      enter("implementation", 10, "claude-sonnet-4-6"),
      enter("review", 20, "claude-opus-5-5"),
      enter("implementation", 30, "claude-sonnet-4-6"),
    ]);

    const [implementation] = stageModelsOf(session);

    expect(implementation?.models).toEqual(["claude-sonnet-4-6"]);
  });

  it("добавляет вторую модель, когда доработка ушла на другую", () => {
    const session = sessionWith([
      enter("implementation", 10, "claude-sonnet-4-6"),
      enter("implementation", 30, "claude-opus-5-5"),
    ]);

    const [implementation] = stageModelsOf(session);

    expect(implementation?.models).toEqual(["claude-sonnet-4-6", "claude-opus-5-5"]);
  });

  it("оставляет этап без моделей, если вход её не назвал", () => {
    const session = sessionWith([enter("planning", 10)]);

    const stages = stageModelsOf(session);

    expect(stages).toEqual([{ stage: "planning", models: [] }]);
  });

  it("пропускает вход без модели, но берёт модель другого входа того же этапа", () => {
    const session = sessionWith([enter("review", 10), enter("review", 30, "claude-opus-5-5")]);

    const [review] = stageModelsOf(session);

    expect(review?.models).toEqual(["claude-opus-5-5"]);
  });

  it("не отдаёт этап, в который сессия не входила", () => {
    const session = sessionWith([enter("planning", 10, "claude-opus-5-5")]);

    const stages = stageModelsOf(session).map(({ stage }) => stage);

    expect(stages).not.toContain("record");
  });
});
