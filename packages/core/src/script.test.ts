import { describe, expect, it } from "vitest";
import type { Recording } from "./recording.ts";
import { headingTo } from "./layout.ts";
import type { ForemanMove } from "./script.ts";
import {
  chatRecording,
  LINE_LAYOUT,
  messageAt,
  PLAIN_PACING,
  reworkRecording,
  stationAt,
} from "./script.fixtures.ts";
import { buildScript } from "./script.ts";

function recordingOf(events: Recording["events"]): Recording {
  return { ...reworkRecording(), events };
}

describe("buildScript", () => {
  it("берёт деталь, несёт следующему станку, отдаёт и возвращается на место", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(
      script.workers.spec.map(({ activity, start, end, carrying }) => [
        activity,
        start,
        end,
        carrying,
      ]),
    ).toEqual([
      ["work", 0, 2_000, false],
      ["handoff", 2_000, 2_200, false],
      ["walk", 2_200, 4_200, true],
      ["walk", 4_200, 14_200, true],
      ["walk", 14_200, 15_200, true],
      ["handoff", 15_200, 15_300, true],
      ["walk", 15_300, 16_300, false],
      ["walk", 16_300, 26_300, false],
      ["walk", 26_300, 28_300, false],
    ]);
  });

  it("ведёт бегущего через проход, а не сквозь чужие места", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const route = script.workers.spec
      .filter((move) => move.activity === "walk" && move.carrying)
      .map((move) => move.to);
    expect(route).toEqual([
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 10, y: 1 },
    ]);
  });

  it("не делает лишнего шага, если получатель напротив через проход", () => {
    const layout = { ...LINE_LAYOUT, stations: { ...LINE_LAYOUT.stations, code: stationAt(0, 4) } };
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 1_000, type: "stage_enter", stage: "code" },
      { t: 2_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, layout, PLAIN_PACING);

    const route = script.workers.spec
      .filter((move) => move.activity === "walk" && move.carrying)
      .map((move) => move.to);
    expect(route).toEqual([
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
  });

  it("передаёт деталь со станка в руки, из рук в руки и на станок получателя", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.part.filter((move) => move.start >= 2_000 && move.start < 15_500)).toEqual([
      {
        start: 2_000,
        end: 2_200,
        from: { on: "machine", station: "spec" },
        to: { on: "hands", station: "spec" },
        status: "ok",
      },
      {
        start: 15_200,
        end: 15_300,
        from: { on: "hands", station: "spec" },
        to: { on: "hands", station: "code" },
        status: "ok",
      },
      {
        start: 15_300,
        end: 15_500,
        from: { on: "hands", station: "code" },
        to: { on: "machine", station: "code" },
        status: "ok",
      },
    ]);
  });

  it("не начинает передачу, пока получатель не вернулся к своему станку", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    // Рабочий кода отнёс деталь на проверки и вернулся только к 44 800.
    expect(script.workers.test[3]).toEqual(
      expect.objectContaining({ activity: "handoff", start: 44_800, end: 45_000 }),
    );
  });

  it("несёт деталь с браком на доработку", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const defects = script.part.filter((move) => move.status === "defect");
    expect(defects.map((move) => move.start)).toEqual([33_000, 44_800, 58_000, 58_100]);
  });

  it("заканчивает сцену, когда все вернулись, а итог — у последнего станка", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect({
      finishAt: script.finishAt,
      duration: script.duration,
      last: script.part.at(-1),
    }).toEqual({
      finishAt: 60_300,
      duration: 71_100,
      last: {
        start: 60_300,
        end: 60_300,
        from: { on: "machine", station: "code" },
        to: { on: "machine", station: "code" },
        status: "done",
      },
    });
  });

  it("списывает деталь, если сборка не удалась", () => {
    const recording = reworkRecording(false);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.part.at(-1)?.status).toBe("scrap");
  });

  it("проводит запись без смены этапов у одного станка", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 500, type: "usage", tokens: 5 },
      { t: 1_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const moves = Object.values(script.workers).map((track) => track.length);
    expect({ moves, finishAt: script.finishAt }).toEqual({
      moves: [1, 0, 0, 0, 0],
      finishAt: 1_000,
    });
  });

  it("кладёт события визита нулевой длины на начало работы", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 2_000, type: "stage_enter", stage: "code" },
      { t: 2_000, type: "usage", tokens: 5 },
      { t: 2_000, type: "build_end", ok: true },
    ]);
    const pacing = { ...PLAIN_PACING, minWorkMs: 1_000 };

    const script = buildScript(recording, LINE_LAYOUT, pacing);

    expect({
      usageAt: script.marks.find((mark) => mark.tokens === 5)?.at,
      finishAt: script.finishAt,
    }).toEqual({ usageAt: 15_500, finishAt: 16_500 });
  });

  it("замораживает сценарий: правка на месте падает, а не портит сцену", () => {
    const script = buildScript(reworkRecording(), LINE_LAYOUT, PLAIN_PACING);
    const post = script.layout.stations.code.post as { y: number };

    const act = () => {
      post.y = 2;
    };

    expect(act).toThrow(TypeError);
  });

  it("не замораживает переданные запись, план и темп", () => {
    const recording = reworkRecording();
    const layout = structuredClone(LINE_LAYOUT);
    const pacing = { ...PLAIN_PACING };

    buildScript(recording, layout, pacing);

    expect(
      [recording.events[1], layout.stations.code.post, pacing].map((value) =>
        Object.isFrozen(value),
      ),
    ).toEqual([false, false, false]);
  });

  it("сжимает работу у станка, но не короче минимума и не дольше максимума", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 60_000, type: "stage_enter", stage: "code" },
      { t: 3_660_000, type: "build_end", ok: true },
    ]);
    const pacing = { ...PLAIN_PACING, compression: 60, minWorkMs: 1_600, maxWorkMs: 8_000 };

    const script = buildScript(recording, LINE_LAYOUT, pacing);

    const workTimes = [...script.workers.spec, ...script.workers.code]
      .filter((move) => move.activity === "work")
      .map((move) => move.end - move.start);
    expect(workTimes).toEqual([1_600, 8_000]);
  });
});

// Мастер идёт из кабинета к станку постановки: до двери 2 с, в проход 4 с, по проходу 19 с
// и к месту у станка 2 с.
const TRIP_TO_SPEC_MS = 27_000;
// Обратно тем же путём: 2 с от станка в проход, 19 по проходу, 4 к двери и 2 до стола.
const TRIP_HOME_MS = 27_000;

function talkingAt(script: { foreman: readonly ForemanMove[] }): ForemanMove[] {
  return script.foreman.filter((move) => move.activity === "talk" || move.activity === "listen");
}

describe("buildScript: мастер", () => {
  const { post, facing } = LINE_LAYOUT.foreman;
  const specPost = LINE_LAYOUT.stations.spec.foremanPost;

  function promptRecording(): Recording {
    return recordingOf([
      { t: 0, type: "build_start" },
      { t: 500, type: "prompt", goal: "Добавь счётчик", requirements: [] },
      messageAt(600, "spec", "foreman"),
      { t: 1_000, type: "build_end", ok: true },
    ]);
  }

  it("ведёт мастера из кабинета через дверь и проход к месту у станка", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.foreman.slice(0, 4).map(({ from, to }) => [from, to])).toEqual([
      [post, { x: 22, y: 6 }],
      [
        { x: 22, y: 6 },
        { x: 22, y: 2 },
      ],
      [
        { x: 22, y: 2 },
        { x: 3, y: 2 },
      ],
      [{ x: 3, y: 2 }, specPost],
    ]);
  });

  it("начинает промпт, когда мастер дошёл до станка", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.prompts).toEqual([
      expect.objectContaining({
        start: 500 + TRIP_TO_SPEC_MS,
        end: 1_500 + TRIP_TO_SPEC_MS,
        station: "spec",
        index: 0,
      }),
    ]);
  });

  it("говорит промпт, а ответ рабочего слушает, лицом к его посту", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const toPost = headingTo(specPost, LINE_LAYOUT.stations.spec.post);
    expect(
      talkingAt(script).map(({ activity, start, end, to, heading }) => [
        activity,
        start,
        end,
        to,
        heading,
      ]),
    ).toEqual([
      ["talk", 27_500, 28_500, specPost, toPost],
      ["listen", 28_500, 29_500, specPost, toPost],
    ]);
  });

  it("ждёт после разговора и уходит в кабинет тем же путём", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const walk = script.foreman.filter((move) => move.start >= 29_500).map((move) => move.to);
    expect(walk).toEqual([{ x: 3, y: 2 }, { x: 22, y: 2 }, { x: 22, y: 6 }, post, post]);
  });

  it("начинает уходить через foremanLingerMs после конца разговора", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.foreman.find((move) => move.start >= 29_500)?.start).toBe(30_000);
  });

  it("у стола поворачивает мастера к столу за turnMs", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.foreman.at(-1)).toMatchObject({
      activity: "idle",
      start: 30_000 + TRIP_HOME_MS,
      end: 30_000 + TRIP_HOME_MS + PLAIN_PACING.turnMs,
      to: post,
      heading: facing,
    });
  });

  it("досматривает сцену до возвращения мастера и поворота у стола", () => {
    const recording = promptRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.duration).toBe(30_000 + TRIP_HOME_MS + PLAIN_PACING.turnMs);
  });

  it("идёт к новой станции напрямую, если следующий разговор начинается раньше ухода", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      messageAt(100, "foreman", "spec"),
      messageAt(100, "foreman", "code"),
      { t: 200, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const afterFirst = script.foreman.filter((move) => move.start >= 28_100);
    expect(afterFirst.slice(0, 4).map(({ activity, start, to }) => [activity, start, to])).toEqual([
      ["walk", 28_100, { x: 3, y: 2 }],
      ["walk", 30_100, { x: 13, y: 2 }],
      ["walk", 40_100, { x: 13, y: 0 }],
      ["talk", 42_100, LINE_LAYOUT.stations.code.foremanPost],
    ]);
  });

  it("выходит из кабинета заново, если пауза между разговорами длиннее ожидания", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const turnAtDesk = script.foreman.findIndex((move) => move.activity === "idle");
    expect(script.foreman[turnAtDesk + 1]).toMatchObject({
      activity: "walk",
      from: post,
      start: script.foreman[turnAtDesk]?.end,
    });
  });

  it("не двигает мастера в записи без промптов и реплик", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect({ prompts: script.prompts, messages: script.messages, foreman: script.foreman }).toEqual(
      { prompts: [], messages: [], foreman: [] },
    );
  });
});

describe("buildScript: реплики", () => {
  it("ставит промпты и реплики в одну очередь, а не друг на друга", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const bubbles = [...script.prompts, ...script.messages].sort((a, b) => a.start - b.start);
    const overlaps = bubbles.filter((bubble, index) => {
      const previous = bubbles[index - 1];
      return previous !== undefined && bubble.start < previous.end;
    });
    expect({ count: bubbles.length, overlaps }).toEqual({ count: 6, overlaps: [] });
  });

  it("ставит реплику после промпта, даже если они стоят в записи рядом", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 500, type: "prompt", goal: "Добавь счётчик", requirements: [] },
      messageAt(500, "spec", "foreman"),
      { t: 1_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect([script.prompts[0]?.end, script.messages[0]?.start]).toEqual([28_500, 28_500]);
  });

  it("не кладёт в сценарий полный текст реплики", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.messages[0]?.message).not.toHaveProperty("text");
  });

  it("не отпускает деталь, пока у станка говорят", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const [work, handoff] = script.workers.spec;
    expect([work?.activity, work?.end, handoff?.activity, handoff?.start]).toEqual([
      "work",
      29_500,
      "handoff",
      29_500,
    ]);
  });

  it("звучит на месте и не двигает мастера, если реплика не между мастером и станцией", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      messageAt(500, "spec", "test"),
      { t: 1_000, type: "stage_enter", stage: "code" },
      { t: 2_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect({
      messages: script.messages.map(({ start, end }) => [start, end]),
      foreman: script.foreman,
    }).toEqual({
      messages: [[500, 1_500]],
      foreman: [],
    });
  });

  it("показывает итог после конца последней реплики", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      messageAt(1_000, "spec", "code"),
      { t: 1_100, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.duration).toBe(2_000 + PLAIN_PACING.finaleMs);
  });

  it("нумерует реплики по записи, а не по порядку звучания", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 100, type: "stage_enter", stage: "code" },
      messageAt(500, "code", "test"),
      messageAt(600, "foreman", "code"),
      { t: 1_000, type: "stage_enter", stage: "test" },
      { t: 2_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.messages.map(({ index }) => index)).toEqual([1, 0]);
  });
});

describe("buildScript: обмен при передаче", () => {
  // Рабочий кода отдаёт деталь проверкам: 2 с в проход, 10 по проходу и 1 с к месту встречи.
  const meet = { x: 20, y: 1 };

  it("звучит у места встречи по порядку записи с прихода отдающего", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const exchange = script.messages.filter(({ index }) => index === 2 || index === 3);
    expect(exchange.map(({ start, end, speaker }) => [start, end, speaker])).toEqual([
      [88_350, 89_350, "code"],
      [89_350, 90_350, "test"],
    ]);
  });

  it("держит отдающего и получателя на месте встречи, пока они говорят", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const giver = script.workers.code.find((move) => move.start === 88_350);
    const taker = script.workers.test.find((move) => move.end === 90_450);
    expect({ giver, taker }).toEqual({
      giver: expect.objectContaining({
        activity: "handoff",
        to: meet,
        end: 90_450,
        carrying: true,
      }),
      taker: expect.objectContaining({ activity: "handoff", carrying: false }),
    });
  });

  it("передаёт деталь из рук в руки после последней реплики", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const handover = script.part.find(
      (move) => move.from.on === "hands" && move.from.station === "code" && move.to.on === "hands",
    );
    expect(handover).toEqual(
      expect.objectContaining({
        start: 90_350,
        end: 90_450,
        from: { on: "hands", station: "code" },
        to: { on: "hands", station: "test" },
      }),
    );
  });

  it("не показывает мастера у обмена", () => {
    const recording = chatRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const exchangeMoves = talkingAt(script).filter(
      (move) => move.start >= 88_350 && move.start < 90_350,
    );
    expect(exchangeMoves).toEqual([]);
  });

  it("устраивает обмен и при возврате с браком, и деталь идёт с браком", () => {
    const recording = recordingOf([
      { t: 0, type: "build_start" },
      { t: 100, type: "stage_enter", stage: "test" },
      messageAt(1_500, "test", "code"),
      { t: 1_600, type: "stage_fail", stage: "test", reason: "проверки не прошли" },
      messageAt(1_700, "code", "test"),
      { t: 2_000, type: "stage_enter", stage: "code" },
      { t: 3_000, type: "build_end", ok: true },
    ]);

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    const handover = script.part.find(
      (move) => move.from.on === "hands" && move.to.station === "code",
    );
    const lastExchange = script.messages.at(-1);
    expect({
      handover: handover?.start,
      lastExchangeEnd: lastExchange?.end,
      status: handover?.status,
    }).toEqual({
      handover: lastExchange?.end,
      lastExchangeEnd: lastExchange?.end,
      status: "defect",
    });
  });
});
