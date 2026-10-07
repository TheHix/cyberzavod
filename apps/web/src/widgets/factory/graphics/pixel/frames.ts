// Выбор кадра рисунка из кадра сцены. Чистые функции: кадр сцены определяет всё, поэтому
// перемотка рисует то же, что проигрывание до этого момента.

import type { ForemanFrame, WorkerFrame } from "@cyberzavod/player";

/** С какой стороны виден персонаж: лицом к зрителю, спиной или боком (вправо). */
export type Facing = "down" | "up" | "side";

/** Кадр удара у станка: замах и удар сменяют друг друга. */
export type WorkBeat = "workA" | "workB";

/** Кадр жеста мастера, пока он говорит: руки поднимаются поочерёдно. */
export type TalkBeat = "talkA" | "talkB";

/**
 * Поза персонажа: стоит, шагает, шагает с деталью в руках (`carryA`, `carryB`), протягивает руки
 * при передаче (`reach`), бьёт у станка или жестикулирует. Каждый кадр пары — свой рисунок.
 */
export type ActorPose =
  "stand" | "walkA" | "walkB" | "carryA" | "carryB" | "reach" | WorkBeat | TalkBeat;

/** Что делает станок: бьёт в такт рабочему или стоит. */
export type MachineWork = WorkBeat | "rest";

/** Кадр персонажа: сторона, зеркало (бок влево) и поза. */
export interface ActorFrame {
  readonly facing: Facing;
  readonly mirrored: boolean;
  readonly pose: ActorPose;
}

/** Сколько мс длится один кадр шага: `walkA` и `walkB` сменяют друг друга. */
export const STEP_FRAME_MS = 200;
/** Сколько мс длится один кадр удара у станка: замах и удар сменяют друг друга. */
export const WORK_FRAME_MS = 300;
/** Сколько мс длится один кадр жеста мастера: медленнее шага, чтобы руки не мельтешили. */
export const TALK_FRAME_MS = 400;
const FRAMES_IN_BEAT = 2;
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

// Два кадра по очереди, первый — в начале действия: `elapsed` отсчитывается от его начала.
function alternating<First extends ActorPose, Second extends ActorPose>(
  elapsed: number,
  frameMs: number,
  first: First,
  second: Second,
): First | Second {
  return Math.floor(elapsed / frameMs) % FRAMES_IN_BEAT === 0 ? first : second;
}

// Удар рабочего и работа его станка идут одним тактом: оба берут кадр отсюда.
function workBeatOf(elapsed: number): WorkBeat {
  return alternating(elapsed, WORK_FRAME_MS, "workA", "workB");
}

/**
 * Кадр рабочего: на ходу ноги сменяются, с деталью в руках — тоже; при передаче руки протянуты,
 * у станка он бьёт; в ожидании стоит.
 * @param {WorkerFrame} worker Рабочий в кадре сцены.
 * @returns {ActorFrame} Сторона, зеркало и поза.
 */
export function workerFrameOf(worker: WorkerFrame): ActorFrame {
  return { ...facingOf(worker.heading), pose: workerPoseOf(worker) };
}

function workerPoseOf(worker: WorkerFrame): ActorPose {
  switch (worker.activity) {
    case "walk":
      return worker.carrying
        ? alternating(worker.elapsed, STEP_FRAME_MS, "carryA", "carryB")
        : alternating(worker.elapsed, STEP_FRAME_MS, "walkA", "walkB");
    case "handoff":
      return "reach";
    case "work":
      return workBeatOf(worker.elapsed);
    case "idle":
      return "stand";
    default:
      return worker.activity satisfies never;
  }
}

/**
 * Кадр мастера: на ходу ноги сменяются, пока говорит — руки жестикулируют, слушая и в кабинете
 * он стоит: неподвижный слушатель рядом с жестикулирующим сразу показывает, кто говорит.
 * @param {ForemanFrame} foreman Мастер в кадре сцены.
 * @returns {ActorFrame} Сторона, зеркало и поза.
 */
export function foremanFrameOf(foreman: ForemanFrame): ActorFrame {
  return { ...facingOf(foreman.heading), pose: foremanPoseOf(foreman) };
}

function foremanPoseOf(foreman: ForemanFrame): ActorPose {
  switch (foreman.activity) {
    case "walk":
      return alternating(foreman.elapsed, STEP_FRAME_MS, "walkA", "walkB");
    case "talk":
      return alternating(foreman.elapsed, TALK_FRAME_MS, "talkA", "talkB");
    case "listen":
    case "idle":
      return "stand";
    default:
      return foreman.activity satisfies never;
  }
}

/**
 * Что делает станок рабочего: пока тот работает, станок бьёт в такт его удару, иначе стоит.
 * @param {WorkerFrame} worker Рабочий этого станка в кадре сцены.
 * @returns {MachineWork} Кадр работы станка или покой.
 */
export function machineWorkOf(worker: WorkerFrame): MachineWork {
  switch (worker.activity) {
    case "work":
      return workBeatOf(worker.elapsed);
    case "walk":
    case "handoff":
    case "idle":
      return "rest";
    default:
      return worker.activity satisfies never;
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
