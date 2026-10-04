import { describe, expect, it } from "vitest";
import type { Activity, ConductorFrame, WorkerFrame } from "@cyberzavod/core";
import { conductorPoseOf, poseOf } from "./pose.ts";

function workerDoing(activity: Activity, carrying = false, elapsed = 105): WorkerFrame {
  return {
    station: "code",
    position: { x: 0, y: 0 },
    heading: 0,
    activity,
    elapsed,
    carrying,
  };
}

describe("poseOf", () => {
  it("тянет руки вперёд при передаче детали", () => {
    const worker = workerDoing("handoff");

    const pose = poseOf(worker);

    expect(pose).toEqual({ reach: 0.38, swing: 0, bob: 0 });
  });

  it("машет руками на бегу без детали", () => {
    const worker = workerDoing("walk");

    const pose = poseOf(worker);

    expect(pose.swing).toBeGreaterThan(0);
  });

  it("держит деталь перед собой на бегу", () => {
    const worker = workerDoing("walk", true);

    const pose = poseOf(worker);

    expect({ reach: pose.reach, swing: pose.swing }).toEqual({ reach: 0.3, swing: 0 });
  });

  it.each([
    [65, 1],
    [195, -1],
  ])("бьёт у станка попеременно: на %i мс руки разнесены в сторону %i", (elapsed, side) => {
    const worker = workerDoing("work", false, elapsed);

    const pose = poseOf(worker);

    expect(Math.sign(pose.swing)).toBe(side);
  });
});

function conductorAt(talking: boolean, elapsed: number): ConductorFrame {
  return { position: { x: 0, y: 0 }, heading: 0, talking, elapsed };
}

describe("conductorPoseOf", () => {
  it.each([
    [150, 1],
    [450, -1],
  ])("покачивает руками, пока говорит: на %i мс руки разнесены в сторону %i", (elapsed, side) => {
    const conductor = conductorAt(true, elapsed);

    const pose = conductorPoseOf(conductor);

    expect(Math.sign(pose.swing)).toBe(side);
  });

  it("не машет руками, пока слушает отчёт", () => {
    const conductor = conductorAt(false, 150);

    const pose = conductorPoseOf(conductor);

    expect(pose.swing).toBe(0);
  });

  it("выносит руки вперёд только на время речи", () => {
    const speaking = conductorPoseOf(conductorAt(true, 0));
    const silent = conductorPoseOf(conductorAt(false, 0));

    expect(speaking.reach).toBeGreaterThan(silent.reach);
  });
});
