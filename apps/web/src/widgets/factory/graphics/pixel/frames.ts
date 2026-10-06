// Выбор кадра рисунка из кадра сцены. Чистые функции: кадр сцены определяет всё, поэтому
// перемотка рисует то же, что проигрывание до этого момента.

import type { ForemanFrame, WorkerFrame } from "@cyberzavod/core";

/** С какой стороны виден персонаж: лицом к зрителю, спиной или боком (вправо). */
export type Facing = "down" | "up" | "side";

/** Поза персонажа: стоит или один из двух кадров шага. */
export type ActorPose = "stand" | "walkA" | "walkB";

/** Кадр персонажа: сторона, зеркало (бок влево) и поза. */
export interface ActorFrame {
  readonly facing: Facing;
  readonly mirrored: boolean;
  readonly pose: ActorPose;
}

/** Сколько мс длится один кадр шага: `walkA` и `walkB` сменяют друг друга. */
export const STEP_FRAME_MS = 200;
const FRAMES_IN_STEP = 2;
// Лампа работающего станка и свечение детали мигают: полупериод — столько мс горит и гаснет.
const LAMP_BLINK_MS = 450;
const GLOW_BLINK_MS = 600;
// Фазы мигания: горит и гаснет.
const BLINK_PHASES = 2;

/**
 * Сторона персонажа по направлению взгляда: боком, если он смотрит скорее вдоль оси x.
 * Направление влево — тот же рисунок «вбок», зеркально.
 * @param {number} heading Куда смотрит персонаж, радианы: 0 — вправо, π/2 — вниз.
 * @returns {Pick<ActorFrame, "facing" | "mirrored">} Сторона рисунка и зеркало.
 */
export function facingOf(heading: number): Pick<ActorFrame, "facing" | "mirrored"> {
  const across = Math.cos(heading);
  const down = Math.sin(heading);
  if (Math.abs(across) > Math.abs(down)) return { facing: "side", mirrored: across < 0 };
  return { facing: down > 0 ? "down" : "up", mirrored: false };
}

function stepPose(elapsed: number): ActorPose {
  return Math.floor(elapsed / STEP_FRAME_MS) % FRAMES_IN_STEP === 0 ? "walkA" : "walkB";
}

/**
 * Кадр рабочего: на ходу ноги сменяются, в остальных занятиях он стоит.
 * @param {WorkerFrame} worker Рабочий в кадре сцены.
 * @returns {ActorFrame} Сторона, зеркало и поза.
 */
export function workerFrameOf(worker: WorkerFrame): ActorFrame {
  return { ...facingOf(worker.heading), pose: workerPoseOf(worker) };
}

function workerPoseOf(worker: WorkerFrame): ActorPose {
  switch (worker.activity) {
    case "walk":
      return stepPose(worker.elapsed);
    case "work":
    case "handoff":
    case "idle":
      return "stand";
    default:
      return worker.activity satisfies never;
  }
}

/**
 * Кадр мастера: на ходу ноги сменяются, говоря, слушая и в кабинете он стоит.
 * @param {ForemanFrame} foreman Мастер в кадре сцены.
 * @returns {ActorFrame} Сторона, зеркало и поза.
 */
export function foremanFrameOf(foreman: ForemanFrame): ActorFrame {
  return { ...facingOf(foreman.heading), pose: foremanPoseOf(foreman) };
}

function foremanPoseOf(foreman: ForemanFrame): ActorPose {
  switch (foreman.activity) {
    case "walk":
      return stepPose(foreman.elapsed);
    case "talk":
    case "listen":
    case "idle":
      return "stand";
    default:
      return foreman.activity satisfies never;
  }
}

function blinkOn(time: number, periodMs: number): boolean {
  return Math.floor(time / periodMs) % BLINK_PHASES === 0;
}

/**
 * Горит ли лампа работающего станка в этот момент сцены: она мигает.
 * @param {number} time Момент сцены, мс.
 * @returns {boolean} `true`, если лампа в этот момент светится.
 */
export function lampLit(time: number): boolean {
  return blinkOn(time, LAMP_BLINK_MS);
}

/**
 * Видно ли свечение детали в этот момент сцены: оно мигает цветом состояния.
 * @param {number} time Момент сцены, мс.
 * @returns {boolean} `true`, если свечение в этот момент видно.
 */
export function glowLit(time: number): boolean {
  return blinkOn(time, GLOW_BLINK_MS);
}
