import { describe, expect, it } from "vitest";
import type { Recording } from "./recording.ts";
import { LINE_LAYOUT, PLAIN_PACING, reworkRecording, stationAt } from "./script.fixtures.ts";
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

  it("вешает промпт над рабочим станка, у которого деталь", () => {
    const recording = reworkRecording();

    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    expect(script.prompts).toEqual([
      expect.objectContaining({ start: 1_000, end: 2_000, station: "spec", index: 0 }),
    ]);
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
      { t: 500, type: "prompt", goal: "Продолжай", requirements: [] },
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
