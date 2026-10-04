import { describe, expect, it } from "vitest";
import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { routeOf } from "./route.ts";

function messageBetween(from: Speaker, to: Speaker): BriefMessageEvent {
  return { t: 0, type: "message", from, to, line: "Реплика" };
}

describe("routeOf", () => {
  it.each([
    ["code", "test", "Код → Проверки"],
    ["spec", "foreman", "Постановка → мастер"],
    ["foreman", "code", "Мастер → Код"],
    ["review", "code", "Ревью → Код"],
  ] as const)("называет маршрут %s → %s: «%s»", (from, to, expected) => {
    const message = messageBetween(from, to);

    const route = routeOf(message);

    expect(route).toBe(expected);
  });
});
