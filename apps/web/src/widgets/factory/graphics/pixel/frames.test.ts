import type { ForemanFrame, WorkerFrame } from "@cyberzavod/core";
import { describe, expect, it } from "vitest";
import {
  facingOf,
  foremanFrameOf,
  glowLit,
  lampLit,
  STEP_FRAME_MS,
  workerFrameOf,
} from "./frames.ts";

function workerFrame(overrides: Partial<WorkerFrame> = {}): WorkerFrame {
  return {
    station: "code",
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

  it.each(["work", "handoff", "idle"] as const)("стоит, пока занят: %s", (activity) => {
    const frame = workerFrameOf(workerFrame({ activity, elapsed: STEP_FRAME_MS }));

    expect(frame.pose).toBe("stand");
  });

  it("смотрит по ходу движения и зеркалит взгляд влево", () => {
    const frame = workerFrameOf(workerFrame({ heading: Math.PI }));

    expect(frame).toMatchObject({ facing: "side", mirrored: true });
  });

  it("даёт одинаковый кадр на одинаковый кадр сцены", () => {
    const worker = workerFrame({ elapsed: 777, heading: 1 });

    const [first, second] = [worker, { ...worker }].map(workerFrameOf);

    expect(first).toEqual(second);
  });
});

describe("foremanFrameOf", () => {
  it("меняет кадры шага через STEP_FRAME_MS", () => {
    const poses = [0, STEP_FRAME_MS].map(
      (elapsed) => foremanFrameOf(foremanFrame({ elapsed })).pose,
    );

    expect(poses).toEqual(["walkA", "walkB"]);
  });

  it.each(["talk", "listen", "idle"] as const)("стоит, пока не идёт: %s", (activity) => {
    const frame = foremanFrameOf(foremanFrame({ activity, elapsed: STEP_FRAME_MS }));

    expect(frame.pose).toBe("stand");
  });

  it("даёт одинаковый кадр на одинаковый кадр сцены", () => {
    const foreman = foremanFrame({ elapsed: 321, heading: -1 });

    const [first, second] = [foreman, { ...foreman }].map(foremanFrameOf);

    expect(first).toEqual(second);
  });
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
