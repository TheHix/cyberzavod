import { arrayAt, countAt, objectAt, stringAt, type JsonObject } from "@/shared/api/fields.ts";

/** How many times a value occurred: a rework stage or an intervention reason. */
export interface TallyRow {
  /** The value from recordings as is: a stage (`review`) or a reason (`plan_review`). */
  readonly key: string;
  readonly count: number;
}

/** Stats over the recordings of public galleries, the `GET /api/stats` response. */
export interface BuildStats {
  readonly recordings: number;
  readonly authors: number;
  readonly tokens: number;
  /** How many recordings passed every stage on the first try, without a single rework. */
  readonly withoutReworks: number;
  /** Reworks (`stage_fail`) by stage. */
  readonly returns: readonly TallyRow[];
  /** Human interventions by reason. */
  readonly interventions: readonly TallyRow[];
  /** Build outcomes by `build_end.ok`. */
  readonly outcomes: { readonly ok: number; readonly failed: number };
}

function tallyRowsAt(stats: JsonObject, field: string, keyField: string): readonly TallyRow[] {
  const place = `строка ${field} в /api/stats`;

  return arrayAt(stats, field, "ответ /api/stats").map((raw) => {
    const row = objectAt(raw, place);

    return { key: stringAt(row, keyField, place), count: countAt(row, "count", place) };
  });
}

/**
 * Parses the `GET /api/stats` response. Stages and reasons are not filtered: whatever is in the
 * recordings is shown.
 * @param {unknown} raw Response body.
 * @returns {BuildStats} Stats.
 * @throws {import("@/shared/api/errors.ts").ApiResponseError} If the response has the wrong shape.
 */
export function parseStats(raw: unknown): BuildStats {
  const place = "ответ /api/stats";
  const stats = objectAt(raw, place);
  const outcomes = objectAt(stats["outcomes"], `outcomes в ${place}`);

  return {
    recordings: countAt(stats, "recordings", place),
    authors: countAt(stats, "authors", place),
    tokens: countAt(stats, "tokens", place),
    withoutReworks: countAt(stats, "withoutReworks", place),
    returns: tallyRowsAt(stats, "returns", "stage"),
    interventions: tallyRowsAt(stats, "interventions", "reason"),
    outcomes: {
      ok: countAt(outcomes, "ok", place),
      failed: countAt(outcomes, "failed", place),
    },
  };
}
