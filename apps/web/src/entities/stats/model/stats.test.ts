import { describe, expect, it } from "vitest";
import { ApiResponseError } from "@/shared/api/errors.ts";
import { parseStats } from "./stats.ts";

function validResponse(): Record<string, unknown> {
  return {
    recordings: 12,
    authors: 3,
    tokens: 4500000,
    returns: [{ stage: "review", count: 7 }],
    interventions: [{ reason: "plan_review", count: 9 }],
    outcomes: { ok: 10, failed: 2 },
  };
}

function withoutField(object: Record<string, unknown>, key: string): Record<string, unknown> {
  const fields = Object.entries(object).filter(([name]) => name !== key);

  return Object.fromEntries(fields);
}

describe("parseStats", () => {
  it("читает числа, возвраты, вмешательства и исходы", () => {
    const stats = parseStats(validResponse());

    expect(stats).toEqual({
      recordings: 12,
      authors: 3,
      tokens: 4500000,
      returns: [{ key: "review", count: 7 }],
      interventions: [{ key: "plan_review", count: 9 }],
      outcomes: { ok: 10, failed: 2 },
    });
  });

  it("оставляет незнакомый этап как есть", () => {
    const raw = { ...validResponse(), returns: [{ stage: "deploy", count: 1 }] };

    const stats = parseStats(raw);

    expect(stats.returns).toEqual([{ key: "deploy", count: 1 }]);
  });

  it("отклоняет ответ без исходов", () => {
    const withoutOutcomes = withoutField(validResponse(), "outcomes");

    const act = () => parseStats(withoutOutcomes);

    expect(act).toThrow(ApiResponseError);
  });

  it("отклоняет строку возвратов без этапа", () => {
    const raw = { ...validResponse(), returns: [{ count: 1 }] };

    const act = () => parseStats(raw);

    expect(act).toThrow("строка returns в /api/stats: stage не строка");
  });
});
