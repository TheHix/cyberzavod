// Picking a sprite frame from a scene frame. Pure functions: the scene frame determines
// everything, so rewinding draws the same as playing up to that moment.

import type { ForemanFrame, WorkerFrame } from "@cyberzavod/player";

/**
 * From which side a character is seen: facing the viewer, from behind, or from the side (right).
 */
export type Facing = "down" | "up" | "side";

/** Strike frame at the machine: the swing and the strike alternate. */
export type WorkBeat = "workA" | "workB";

/** Foreman gesture frame while speaking: the arms rise in turn. */
export type TalkBeat = "talkA" | "talkB";

/**
 * Character pose: stands, walks, walks with the part in hands (`carryA`, `carryB`), reaches out
 * when handing over (`reach`), strikes at the machine, or gestures. Each frame of a pair is its own
 * sprite.
 */
export type ActorPose =
  "stand" | "walkA" | "walkB" | "carryA" | "carryB" | "reach" | WorkBeat | TalkBeat;

/** What the machine does: strikes in time with the worker, or stands. */
export type MachineWork = WorkBeat | "rest";

/** Character frame: side, mirroring (side view to the left) and pose. */
export interface ActorFrame {
  readonly facing: Facing;
  readonly mirrored: boolean;
  readonly pose: ActorPose;
}

/** How many ms one step frame lasts: `walkA` and `walkB` alternate. */
export const STEP_FRAME_MS = 200;
/** How many ms one strike frame at the machine lasts: the swing and the strike alternate. */
export const WORK_FRAME_MS = 300;
/** How many ms one foreman gesture frame lasts: slower than a step, so the arms do not flicker. */
export const TALK_FRAME_MS = 400;
const FRAMES_IN_BEAT = 2;
// The lamp of a working machine and the part glow blink: the half period is how many ms it is on
// and off.
const LAMP_BLINK_MS = 450;
const GLOW_BLINK_MS = 600;
// Blink phases: on and off.
const BLINK_PHASES = 2;

/**
 * Character side by gaze direction: the side view if they look more along the x axis. Facing left
 * is the same side sprite, mirrored.
 * @param {number} heading Where the character looks, radians: 0 is right, π/2 is down.
 * @returns {Pick<ActorFrame, "facing" | "mirrored">} Sprite side and mirroring.
 */
export function facingOf(heading: number): Pick<ActorFrame, "facing" | "mirrored"> {
  const across = Math.cos(heading);
  const down = Math.sin(heading);

  if (Math.abs(across) > Math.abs(down)) return { facing: "side", mirrored: across < 0 };

  return { facing: down > 0 ? "down" : "up", mirrored: false };
}

// Two frames in turn, the first at the start of the action: `elapsed` counts from its start.
function alternating<First extends ActorPose, Second extends ActorPose>(
  elapsed: number,
  frameMs: number,
  first: First,
  second: Second,
): First | Second {
  return Math.floor(elapsed / frameMs) % FRAMES_IN_BEAT === 0 ? first : second;
}

// The worker's strike and the work of their machine share one beat: both take the frame from here.
function workBeatOf(elapsed: number): WorkBeat {
  return alternating(elapsed, WORK_FRAME_MS, "workA", "workB");
}

/**
 * Worker frame: walking, the legs alternate, also with the part in hands; when handing over, the
 * arms reach out; at the machine they strike; while waiting they stand.
 * @param {WorkerFrame} worker Worker in the scene frame.
 * @returns {ActorFrame} Side, mirroring and pose.
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
 * Foreman frame: walking, the legs alternate; while speaking, the arms gesture; listening and in
 * the office they stand: a still listener next to a gesturing one shows at once who is speaking.
 * @param {ForemanFrame} foreman Foreman in the scene frame.
 * @returns {ActorFrame} Side, mirroring and pose.
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
 * What the worker's machine does: while the worker works, the machine strikes in time with their
 * strike, otherwise it stands.
 * @param {WorkerFrame} worker The worker of this machine in the scene frame.
 * @returns {MachineWork} Machine work frame or rest.
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

function isBlinkOn(time: number, periodMs: number): boolean {
  return Math.floor(time / periodMs) % BLINK_PHASES === 0;
}

/**
 * Whether the lamp of a working machine is on at this scene moment: it blinks.
 * @param {number} time Scene moment, ms.
 * @returns {boolean} `true` if the lamp is lit at this moment.
 */
export function lampLit(time: number): boolean {
  return isBlinkOn(time, LAMP_BLINK_MS);
}

/**
 * Whether the part glow is visible at this scene moment: it blinks in the state color.
 * @param {number} time Scene moment, ms.
 * @returns {boolean} `true` if the glow is visible at this moment.
 */
export function glowLit(time: number): boolean {
  return isBlinkOn(time, GLOW_BLINK_MS);
}
