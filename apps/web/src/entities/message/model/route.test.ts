import { describe, expect, it } from "vitest";
import type { BriefMessageEvent, Listener, Speaker } from "@cyberzavod/core";
import { routeOf } from "./route.ts";

function messageBetween(from: Speaker, to: Listener): BriefMessageEvent {
  return { t: 0, type: "message", from, to, line: "Реплика" };
}

describe("routeOf", () => {
  it.each([
    ["conductor", "code", "Мастер → Код"],
    ["review", "conductor", "Ревью → мастер"],
    ["conductor", "human", "Мастер → человек"],
    ["code", "human", "Код → человек"],
  ] as const)("называет маршрут %s → %s: «%s»", (from, to, expected) => {
    const message = messageBetween(from, to);

    const route = routeOf(message);

    expect(route).toBe(expected);
  });

  it("пишет одно слово, если говорящий и адресат совпадают", () => {
    const message = messageBetween("conductor", "conductor");

    const route = routeOf(message);

    expect(route).toBe("Мастер");
  });
});
