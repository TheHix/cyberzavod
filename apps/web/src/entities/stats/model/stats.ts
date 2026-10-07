import { arrayAt, countAt, objectAt, stringAt, type JsonObject } from "@/shared/api/fields.ts";

/** Сколько раз встретилось значение: этап возврата или причина вмешательства. */
export interface TallyRow {
  /** Значение из записей как есть: этап (`review`) или причина (`plan_review`). */
  readonly key: string;
  readonly count: number;
}

/** Аналитика по записям открытых галерей — ответ `GET /api/stats`. */
export interface BuildStats {
  readonly recordings: number;
  readonly authors: number;
  readonly tokens: number;
  /** Возвраты на доработку (`stage_fail`) по этапам. */
  readonly returns: readonly TallyRow[];
  /** Вмешательства человека по причинам. */
  readonly interventions: readonly TallyRow[];
  /** Исходы сборок по `build_end.ok`. */
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
 * Разбирает ответ `GET /api/stats`. Этапы и причины не фильтруются: что в записях, то и
 * показывается.
 * @param {unknown} raw Тело ответа.
 * @returns {BuildStats} Аналитика.
 * @throws {import("@/shared/api/errors.ts").ApiResponseError} Если ответ не того вида.
 */
export function parseStats(raw: unknown): BuildStats {
  const place = "ответ /api/stats";
  const stats = objectAt(raw, place);
  const outcomes = objectAt(stats["outcomes"], `outcomes в ${place}`);

  return {
    recordings: countAt(stats, "recordings", place),
    authors: countAt(stats, "authors", place),
    tokens: countAt(stats, "tokens", place),
    returns: tallyRowsAt(stats, "returns", "stage"),
    interventions: tallyRowsAt(stats, "interventions", "reason"),
    outcomes: {
      ok: countAt(outcomes, "ok", place),
      failed: countAt(outcomes, "failed", place),
    },
  };
}
