import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@cyberzavod/core";
import { headerOf, timelineOf, type TimelineEntry } from "./timeline.ts";

function buildEvents(): SessionEvent[] {
  return [
    { t: 0, type: "build_start" },
    { t: 1000, type: "prompt", goal: "Собрать сайт", requirements: [] },
    { t: 2000, type: "stage_enter", stage: "implementation" },
    {
      t: 3000,
      type: "message",
      from: "implementation",
      to: "review",
      line: "Готово",
      text: "Код готов.",
    },
    { t: 4000, type: "intervention", reason: "plan_review", line: "Делаем", text: "Одобрено." },
    { t: 5000, type: "prompt", goal: "Поправить меню", requirements: ["Короче"] },
    { t: 6000, type: "build_end", ok: true },
  ];
}

function entryOf(kind: TimelineEntry["kind"]): TimelineEntry {
  const entry = timelineOf(buildEvents()).find((candidate) => candidate.kind === kind);

  if (entry === undefined) throw new Error(`в тестовой записи нет ${kind}`);

  return entry;
}

describe("timelineOf", () => {
  it("оставляет промпты, реплики и вмешательства по времени с номерами, как в цехе", () => {
    const speeches = timelineOf(buildEvents()).map((entry) => entry.speech);

    expect(speeches).toEqual([
      { kind: "prompt", index: 0 },
      { kind: "message", index: 0 },
      { kind: "intervention", index: 0 },
      { kind: "prompt", index: 1 },
    ]);
  });

  it("возвращает пустой журнал для сборки без речи", () => {
    const entries = timelineOf([
      { t: 0, type: "build_start" },
      { t: 1, type: "build_end", ok: true },
    ]);

    expect(entries).toEqual([]);
  });
});

describe("headerOf", () => {
  it("подписывает промпт получателем и не даёт ему якоря", () => {
    const header = headerOf(entryOf("prompt"), "ru");

    expect(header).toEqual({ anchor: undefined, clock: "0:01", route: "человек → агент" });
  });

  it("даёт реплике якорь и маршрут", () => {
    const header = headerOf(entryOf("message"), "en");

    expect(header).toEqual({ anchor: "message-1", clock: "0:03", route: "Code → Review" });
  });

  it("даёт вмешательству якорь и метку причины", () => {
    const header = headerOf(entryOf("intervention"), "ru");

    expect(header).toEqual({
      anchor: "intervention-1",
      clock: "0:04",
      route: "человек · решение по постановке",
    });
  });
});
