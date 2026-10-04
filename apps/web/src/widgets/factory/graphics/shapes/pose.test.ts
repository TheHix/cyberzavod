import { describe, expect, it } from "vitest";
import type { Activity, WorkerFrame } from "@cyberzavod/core";
import { poseOf } from "./pose.ts";

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
