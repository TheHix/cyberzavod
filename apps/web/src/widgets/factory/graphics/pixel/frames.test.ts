import type { ForemanFrame, WorkerFrame } from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import {
  facingOf,
  foremanFrameOf,
  glowLit,
  lampLit,
  machineWorkOf,
  STEP_FRAME_MS,
  TALK_FRAME_MS,
  WORK_FRAME_MS,
  workerFrameOf,
} from "./frames.ts";

function workerFrame(overrides: Partial<WorkerFrame> = {}): WorkerFrame {
  return {
    station: "implementation",
    position: { x: 1, y: 1 },
    heading: 0,
    activity: "walk",
    elapsed: 0,
    carrying: false,
    ...overrides,
  };
}

function foremanFrame(overrides: Partial<ForemanFrame> = {}): ForemanFrame {
  return { position: { x: 1, y: 1 }, heading: 0, activity: "walk", elapsed: 0, ...overrides };
}

describe("facingOf", () => {
  it.each([
    ["вправо", 0, { facing: "side", mirrored: false }],
    ["влево", Math.PI, { facing: "side", mirrored: true }],
    ["вниз", Math.PI / 2, { facing: "down", mirrored: false }],
    ["вверх", -Math.PI / 2, { facing: "up", mirrored: false }],
    ["чуть правее диагонали вниз", Math.PI / 4 - 0.1, { facing: "side", mirrored: false }],
    ["чуть левее диагонали вниз", Math.PI / 4 + 0.1, { facing: "down", mirrored: false }],
    ["вниз-влево", (3 * Math.PI) / 4 - 0.1, { facing: "down", mirrored: false }],
    [
      "чуть левее диагонали влево-вниз",
      (3 * Math.PI) / 4 + 0.1,
      { facing: "side", mirrored: true },
    ],
    ["вверх-вправо", -Math.PI / 4 + 0.1, { facing: "side", mirrored: false }],
    ["вверх-влево", (-3 * Math.PI) / 4 + 0.1, { facing: "up", mirrored: false }],
  ])("смотрит %s", (_name, heading, expected) => {
    const frame = facingOf(heading);

    expect(frame).toEqual(expected);
  });
});

describe("workerFrameOf", () => {
  it("меняет кадры шага через STEP_FRAME_MS", () => {
    const poses = [0, STEP_FRAME_MS, STEP_FRAME_MS * 2].map(
      (elapsed) => workerFrameOf(workerFrame({ elapsed })).pose,
    );

    expect(poses).toEqual(["walkA", "walkB", "walkA"]);
  });

  it("шагает с деталью кадрами carryA и carryB через STEP_FRAME_MS", () => {
    const poses = [0, STEP_FRAME_MS, STEP_FRAME_MS * 2].map(
      (elapsed) => workerFrameOf(workerFrame({ carrying: true, elapsed })).pose,
    );

    expect(poses).toEqual(["carryA", "carryB", "carryA"]);
  });

  it.each([true, false])("тянется при передаче, с деталью: %s", (carrying) => {
    const frame = workerFrameOf(
      workerFrame({ activity: "handoff", carrying, elapsed: STEP_FRAME_MS }),
    );

    expect(frame.pose).toBe("reach");
  });

  it("бьёт у станка кадрами workA и workB через WORK_FRAME_MS", () => {
    const poses = [0, WORK_FRAME_MS - 1, WORK_FRAME_MS, WORK_FRAME_MS * 2].map(
      (elapsed) => workerFrameOf(workerFrame({ activity: "work", elapsed })).pose,
    );

    expect(poses).toEqual(["workA", "workA", "workB", "workA"]);
  });

  it("стоит, пока ничем не занят", () => {
    const frame = workerFrameOf(workerFrame({ activity: "idle", elapsed: STEP_FRAME_MS }));

    expect(frame.pose).toBe("stand");
  });

  it("смотрит по ходу движения и зеркалит взгляд влево", () => {
    const frame = workerFrameOf(workerFrame({ heading: Math.PI }));

    expect(frame).toMatchObject({ facing: "side", mirrored: true });
  });

  it.each(["walk", "work", "handoff"] as const)(
    "даёт одинаковый кадр на одинаковый кадр сцены: %s",
    (activity) => {
      const worker = workerFrame({ activity, elapsed: 777, heading: 1, carrying: true });

      const [first, second] = [worker, { ...worker }].map(workerFrameOf);

      expect(first).toEqual(second);
    },
  );
});

describe("foremanFrameOf", () => {
  it("меняет кадры шага через STEP_FRAME_MS", () => {
    const poses = [0, STEP_FRAME_MS].map(
      (elapsed) => foremanFrameOf(foremanFrame({ elapsed })).pose,
    );

    expect(poses).toEqual(["walkA", "walkB"]);
  });

  it("жестикулирует, пока говорит, через TALK_FRAME_MS", () => {
    const poses = [0, TALK_FRAME_MS - 1, TALK_FRAME_MS, TALK_FRAME_MS * 2].map(
      (elapsed) => foremanFrameOf(foremanFrame({ activity: "talk", elapsed })).pose,
    );

    expect(poses).toEqual(["talkA", "talkA", "talkB", "talkA"]);
  });

  it.each(["listen", "idle"] as const)("стоит, пока не идёт и не говорит: %s", (activity) => {
    const frame = foremanFrameOf(foremanFrame({ activity, elapsed: TALK_FRAME_MS }));

    expect(frame.pose).toBe("stand");
  });

  it.each(["walk", "talk"] as const)(
    "даёт одинаковый кадр на одинаковый кадр сцены: %s",
    (activity) => {
      const foreman = foremanFrame({ activity, elapsed: 321, heading: -1 });

      const [first, second] = [foreman, { ...foreman }].map(foremanFrameOf);

      expect(first).toEqual(second);
    },
  );
});

describe("machineWorkOf", () => {
  it.each(["walk", "handoff", "idle"] as const)(
    "стоит, пока рабочий не работает: %s",
    (activity) => {
      const work = machineWorkOf(workerFrame({ activity, elapsed: WORK_FRAME_MS }));

      expect(work).toBe("rest");
    },
  );

  it.each([0, WORK_FRAME_MS - 1, WORK_FRAME_MS, WORK_FRAME_MS * 3, 12_345])(
    "работает в такт удару рабочего: elapsed %d",
    (elapsed) => {
      const worker = workerFrame({ activity: "work", elapsed });

      const work = machineWorkOf(worker);

      expect(work).toBe(workerFrameOf(worker).pose);
    },
  );
});

describe("lampLit", () => {
  it("горит и гаснет со своим периодом", () => {
    const states = [0, 449, 450, 899, 900].map(lampLit);

    expect(states).toEqual([true, true, false, false, true]);
  });
});

describe("glowLit", () => {
  it("мигает со своим периодом, медленнее лампы", () => {
    const states = [0, 599, 600, 1199, 1200].map(glowLit);

    expect(states).toEqual([true, true, false, false, true]);
  });
});
