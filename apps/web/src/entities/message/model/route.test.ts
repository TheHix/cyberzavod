import { describe, expect, it } from "vitest";
import type { BriefMessageEvent, Speaker } from "@cyberzavod/core";
import { routeOf } from "./route.ts";

function messageBetween(from: Speaker, to: Speaker): BriefMessageEvent {
  return { t: 0, type: "message", from, to, line: "Реплика" };
}

describe("routeOf", () => {
  it.each([
    ["code", "test", "ru", "Код → Проверки"],
    ["spec", "foreman", "ru", "Постановка → мастер"],
    ["foreman", "code", "ru", "Мастер → Код"],
    ["review", "code", "ru", "Ревью → Код"],
    ["code", "test", "en", "Code → Tests"],
    ["spec", "foreman", "en", "Spec → foreman"],
    ["foreman", "code", "en", "Foreman → Code"],
    ["review", "code", "en", "Review → Code"],
  ] as const)("называет маршрут %s → %s на языке %s: «%s»", (from, to, locale, expected) => {
    const message = messageBetween(from, to);

    const route = routeOf(message, locale);

    expect(route).toBe(expected);
  });
});
