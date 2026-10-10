import { describe, expect, it } from "vitest";
import { reworksOf } from "./rework.ts";
import { summarize, type MessageEvent, type SessionEvent, type SessionRecord } from "./record.ts";
import type { Stage } from "./stage.ts";

function sessionWith(events: SessionEvent[]): SessionRecord {
  return {
    version: 1,
    type: "session",
    id: "2026-10-07-79fd668f",
    timestamp: "2026-10-07T21:39:18.968Z",
    projectId: "split-bill",
    source: { type: "manual" },
    data: { title: "Сборка", language: "ru", workflow: "default", harness: "0.0.0", events },
  };
}

function messageFrom(from: Stage, t: number, line: string): MessageEvent {
  return { t, type: "message", from, to: "implementation", line, text: `${line} Подробнее.` };
}

function enter(stage: Stage, t: number): SessionEvent {
  return { t, type: "stage_enter", stage };
}

function fail(stage: Stage, t: number): SessionEvent {
  return { t, type: "stage_fail", stage, reason: "Этап вернул работу" };
}

describe("reworksOf", () => {
  it("берёт последнюю реплику этапа перед возвратом", () => {
    const first = messageFrom("review", 10, "Сначала замечание");
    const last = messageFrom("review", 20, "Верну: нет теста");
    const session = sessionWith([enter("review", 5), first, last, fail("review", 30)]);

    const [rework] = reworksOf(session);

    expect(rework?.message).toBe(last);
  });

  it("отдаёт момент, этап и причину возврата", () => {
    const session = sessionWith([enter("verification", 5), fail("verification", 30)]);

    const reworks = reworksOf(session);

    expect(reworks).toEqual([
      { t: 30, stage: "verification", reason: "Этап вернул работу", message: undefined },
    ]);
  });

  it("не берёт реплику, сказанную до входа на этап", () => {
    const earlier = messageFrom("review", 1, "Реплика прошлого прохода");
    const session = sessionWith([earlier, enter("review", 5), fail("review", 30)]);

    const [rework] = reworksOf(session);

    expect(rework?.message).toBeUndefined();
  });

  it("игнорирует реплики других этапов", () => {
    const foreign = messageFrom("implementation", 20, "Готово");
    const session = sessionWith([enter("review", 5), foreign, fail("review", 30)]);

    const [rework] = reworksOf(session);

    expect(rework?.message).toBeUndefined();
  });

  it("у двух возвратов одного этапа у каждого своя реплика", () => {
    const firstWords = messageFrom("review", 10, "Первое замечание");
    const secondWords = messageFrom("review", 50, "Второе замечание");
    const session = sessionWith([
      enter("review", 5),
      firstWords,
      fail("review", 20),
      secondWords,
      fail("review", 60),
    ]);

    const messages = reworksOf(session).map((rework) => rework.message);

    expect(messages).toEqual([firstWords, secondWords]);
  });

  it("не отдаёт реплику первого возврата второму, если этап промолчал", () => {
    const firstWords = messageFrom("review", 10, "Первое замечание");
    const session = sessionWith([
      enter("review", 5),
      firstWords,
      fail("review", 20),
      fail("review", 60),
    ]);

    const messages = reworksOf(session).map((rework) => rework.message);

    expect(messages).toEqual([firstWords, undefined]);
  });

  it("без возвратов даёт пустой список", () => {
    const session = sessionWith([enter("review", 5), messageFrom("review", 10, "Принято")]);

    const reworks = reworksOf(session);

    expect(reworks).toEqual([]);
  });

  it("считает столько же возвратов, сколько summarize", () => {
    const session = sessionWith([
      enter("review", 5),
      fail("review", 20),
      enter("verification", 25),
      fail("verification", 40),
    ]);

    const reworks = reworksOf(session);

    expect(reworks).toHaveLength(summarize(session).reworks);
  });

  it("без событий даёт пустой список", () => {
    const session = sessionWith([]);

    const reworks = reworksOf(session);

    expect(reworks).toEqual([]);
  });

  it("возврат без входа на этап берёт реплику с начала сессии", () => {
    const words = messageFrom("review", 1, "Верну: без входа");
    const session = sessionWith([words, fail("review", 30)]);

    const [rework] = reworksOf(session);

    expect(rework?.message).toBe(words);
  });

  it("возврат первым событием остаётся без реплики", () => {
    const session = sessionWith([fail("review", 0)]);

    const reworks = reworksOf(session);

    expect(reworks).toEqual([
      { t: 0, stage: "review", reason: "Этап вернул работу", message: undefined },
    ]);
  });
});
