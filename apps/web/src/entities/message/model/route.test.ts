import { describe, expect, it } from "vitest";
import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { routeOf } from "./route.ts";

function messageBetween(from: Speaker, to: Speaker): BriefMessageEvent {
  return { t: 0, type: "message", from, to, line: "Реплика" };
}

describe("routeOf", () => {
  it.each([
    ["implementation", "verification", "ru", "Код → Проверки"],
    ["planning", "foreman", "ru", "Постановка → мастер"],
    ["foreman", "implementation", "ru", "Мастер → Код"],
    ["review", "implementation", "ru", "Ревью → Код"],
    ["implementation", "verification", "en", "Code → Verify"],
    ["planning", "foreman", "en", "Plan → foreman"],
    ["foreman", "implementation", "en", "Foreman → Code"],
    ["review", "implementation", "en", "Review → Code"],
  ] as const)("называет маршрут %s → %s на языке %s: «%s»", (from, to, locale, expected) => {
    const message = messageBetween(from, to);

    const route = routeOf(message, locale);

    expect(route).toBe(expected);
  });
});
