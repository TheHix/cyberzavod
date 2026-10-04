// Поза рабочего вида сверху: насколько руки вынесены вперёд, как они качаются и как
// пружинит шаг. Считается из кадра, поэтому при перемотке поза та же, что при просмотре.

import type { ForemanFrame, WorkerFrame } from "@cyberzavod/core";

/** Поза рабочего в единицах плана: `reach` — вынос рук вперёд, `swing` — разнос рук, `bob` — пружина шага. */
export interface Pose {
  readonly reach: number;
  readonly swing: number;
  readonly bob: number;
}

const FULL_TURN = Math.PI * 2;
// Длительность шага, удара у станка и вдоха, мс: шаг спокойный, работа — частая.
const STEP_MS = 420;
const STRIKE_MS = 260;
const BREATH_MS = 2_400;
// Вынос рук вперёд, единиц плана: опущены, на бегу, с деталью, у станка, при передаче.
const REACH = { rest: 0.08, walk: 0.12, hold: 0.3, work: 0.3, handoff: 0.38 } as const;
// Размах рук: на бегу и при ударах у станка.
const SWING = { walk: 0.12, work: 0.07 } as const;
// Пружина шага и дыхание стоящего.
const BOB = { walk: 0.04, breath: 0.015 } as const;
// Мастер, пока говорит, жестикулирует: руки вынесены вперёд и покачиваются в такт речи.
const GESTURE = { periodMs: 600, reach: 0.22, swing: 0.1 } as const;

function wave(elapsed: number, periodMs: number): number {
  return Math.sin((elapsed / periodMs) * FULL_TURN);
}

// Бег без детали: руки машут в такт шагу.
function walkingPose(elapsed: number): Pose {
  const step = wave(elapsed, STEP_MS);
  return { reach: REACH.walk, swing: SWING.walk * step, bob: BOB.walk * Math.abs(step) };
}

// Стоящий дышит: руки опущены.
function restingPose(elapsed: number): Pose {
  return { reach: REACH.rest, swing: 0, bob: BOB.breath * wave(elapsed, BREATH_MS) };
}

/**
 * Поза рабочего в кадре.
 * @param {WorkerFrame} worker Рабочий в кадре.
 * @returns {Pose} Вынос и разнос рук и пружина шага.
 */
export function poseOf(worker: WorkerFrame): Pose {
  switch (worker.activity) {
    case "walk": {
      const pose = walkingPose(worker.elapsed);
      // С деталью руки держат её перед собой и не машут.
      return worker.carrying ? { ...pose, reach: REACH.hold, swing: 0 } : pose;
    }
    case "work":
      return { reach: REACH.work, swing: SWING.work * wave(worker.elapsed, STRIKE_MS), bob: 0 };
    case "handoff":
      return { reach: REACH.handoff, swing: 0, bob: 0 };
    case "idle":
      return restingPose(worker.elapsed);
    default:
      return worker.activity satisfies never;
  }
}

/**
 * Поза мастера в кадре: идёт как рабочий без детали, пока говорит — покачивает руками, а
 * слушая и ожидая, стоит спокойно.
 * @param {ForemanFrame} foreman Мастер в кадре.
 * @returns {Pose} Вынос и разнос рук и пружина шага или дыхание.
 */
export function foremanPoseOf(foreman: ForemanFrame): Pose {
  switch (foreman.activity) {
    case "walk":
      return walkingPose(foreman.elapsed);
    case "talk":
      return {
        reach: GESTURE.reach,
        swing: GESTURE.swing * wave(foreman.elapsed, GESTURE.periodMs),
        bob: 0,
      };
    case "listen":
    case "idle":
      return restingPose(foreman.elapsed);
    default:
      return foreman.activity satisfies never;
  }
}
