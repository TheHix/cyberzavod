import { describe, expect, it } from "vitest";
import type { Activity, ForemanActivity, ForemanFrame, WorkerFrame } from "@cyberzavod/core";
import { foremanPoseOf, poseOf } from "./pose.ts";

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

function foremanDoing(activity: ForemanActivity, elapsed = 105): ForemanFrame {
  return { position: { x: 0, y: 0 }, heading: 0, activity, elapsed };
}

describe("foremanPoseOf", () => {
  it.each([
    [150, 1],
    [450, -1],
  ])("покачивает руками, пока говорит: на %i мс руки разнесены в сторону %i", (elapsed, side) => {
    const foreman = foremanDoing("talk", elapsed);

    const pose = foremanPoseOf(foreman);

    expect(Math.sign(pose.swing)).toBe(side);
  });

  it("машет руками на ходу, как рабочий без детали", () => {
    const foreman = foremanDoing("walk");
    const worker = workerDoing("walk");

    const pose = foremanPoseOf(foreman);

    expect(pose).toEqual(poseOf(worker));
  });

  it.each(["listen", "idle"] as const)("стоит спокойно, дыша, когда он %s", (activity) => {
    const foreman = foremanDoing(activity, 600);

    const pose = foremanPoseOf(foreman);

    expect(pose).toEqual({ reach: 0.08, swing: 0, bob: expect.closeTo(0.015) });
  });

  it("выносит руки вперёд только на время речи", () => {
    const speaking = foremanPoseOf(foremanDoing("talk", 0));
    const silent = foremanPoseOf(foremanDoing("listen", 0));

    expect(speaking.reach).toBeGreaterThan(silent.reach);
  });
});
