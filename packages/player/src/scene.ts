// Factory frame at a scene moment: where each worker and the foreman are, what they are busy with,
// where the part is, which prompt, intervention and message are showing.
// Computed from the script by binary search, without state: seeking to any point is free,
// and a frame costs O(log n) in the recording length.

import { pointBetween, type Point } from "./layout.ts";
import { type Tally, STAGES, type Stage } from "@cyberzavod/core";
import { progressOf, turned } from "./turn.ts";
import type {
  Activity,
  FactoryScript,
  ForemanActivity,
  ForemanMove,
  InterventionCue,
  MessageCue,
  PartPlace,
  PartStatus,
  PromptCue,
  WorkerMove,
} from "./script.ts";

/** A worker in the frame; `elapsed` is ms spent on the current task, for animation. */
export interface WorkerFrame {
  readonly station: Stage;
  readonly position: Point;
  readonly heading: number;
  readonly activity: Activity;
  readonly elapsed: number;
  readonly carrying: boolean;
}

/** The part in the frame: where it is, at whose machine and in what status. */
export interface PartFrame {
  readonly position: Point;
  readonly holder: Stage;
  readonly carried: boolean;
  readonly status: PartStatus;
}

/** The prompt now showing above a worker, and how many ms it has been visible. */
export interface PromptFrame {
  readonly cue: PromptCue;
  readonly elapsed: number;
}

/** The intervention the foreman is now saying at a station, and how many ms it has been visible. */
export interface InterventionFrame {
  readonly cue: InterventionCue;
  readonly elapsed: number;
}

/** The message now showing above the speaker, and how many ms it has been visible. */
export interface MessageFrame {
  readonly cue: MessageCue;
  readonly elapsed: number;
}

/** The foreman in the frame; `elapsed` is ms spent on the current task, for animation. */
export interface ForemanFrame {
  readonly position: Point;
  readonly heading: number;
  readonly activity: ForemanActivity;
  readonly elapsed: number;
}

/** Factory frame at a scene moment. */
export interface Scene {
  /** Scene moment, ms. */
  readonly time: number;
  /** The matching recording moment, ms from the start of the build. */
  readonly recordingTime: number;
  /** Workers in stage order. */
  readonly workers: readonly WorkerFrame[];
  readonly part: PartFrame;
  readonly prompt: PromptFrame | null;
  readonly intervention: InterventionFrame | null;
  readonly message: MessageFrame | null;
  readonly foreman: ForemanFrame;
  readonly counts: Tally;
  readonly finished: boolean;
}

// A carried part sits slightly ahead of the worker, in the direction they face.
const CARRY_DISTANCE = 0.45;

/**
 * Index of the last element that started no later than the moment. Elements are sorted by start,
 * as the script lays them out. Does not leave the package.
 * @param {readonly T[]} items Script elements in ascending order of start.
 * @param {number} time Scene moment, ms.
 * @param {(item: T) => number} startOf Start of an element, scene ms.
 * @returns {number} Element index; -1 if none has started yet.
 */
export function lastStartedIndex<T>(
  items: readonly T[],
  time: number,
  startOf: (item: T) => number,
): number {
  let low = 0;
  let high = items.length - 1;
  let found = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const item = items[middle];

    if (item !== undefined && startOf(item) <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
}

// Where the actor faces: they turn toward the action's direction within `turnMs` of its start.
function headingAt(move: WorkerMove | ForemanMove, turnMs: number, time: number): number {
  const turn = progressOf(move.start, move.start + turnMs, time);

  return turn === 1 ? move.heading : turned(move.turnFrom, move.heading, turn);
}

function workerAt(script: FactoryScript, station: Stage, time: number): WorkerFrame {
  const moves = script.workers[station];
  const plan = script.layout.stations[station];
  const index = lastStartedIndex(moves, time, (m) => m.start);
  const move: WorkerMove | undefined = moves[index];

  if (move === undefined || time >= move.end) {
    // Between actions a worker stands at their machine: every action ends there.
    return {
      station,
      position: plan.post,
      heading: plan.facing,
      activity: "idle",
      elapsed: time - (move?.end ?? 0),
      carrying: false,
    };
  }

  return {
    station,
    position: pointBetween(move.from, move.to, progressOf(move.start, move.end, time)),
    heading: headingAt(move, script.pacing.turnMs, time),
    activity: move.activity,
    elapsed: time - move.since,
    carrying: move.carrying,
  };
}

function placeOf(script: FactoryScript, workers: readonly WorkerFrame[], place: PartPlace) {
  const holder = workers.find((worker) => worker.station === place.station);

  if (place.on === "machine" || holder === undefined) {
    return script.layout.stations[place.station].machine;
  }

  const { position, heading } = holder;

  return {
    x: position.x + Math.cos(heading) * CARRY_DISTANCE,
    y: position.y + Math.sin(heading) * CARRY_DISTANCE,
  };
}

function partAt(script: FactoryScript, workers: readonly WorkerFrame[], time: number): PartFrame {
  const index = lastStartedIndex(script.part, time, (m) => m.start);
  const move = script.part[index];

  if (move === undefined) {
    const station = STAGES[0];

    return {
      position: script.layout.stations[station].machine,
      holder: station,
      carried: false,
      status: "ok",
    };
  }

  const from = placeOf(script, workers, move.from);
  const to = placeOf(script, workers, move.to);

  return {
    position: pointBetween(from, to, progressOf(move.start, move.end, time)),
    holder: move.to.station,
    carried: move.to.on === "hands",
    status: move.status,
  };
}

// The bubble showing at this moment: a prompt, an intervention or a message; `null` means none.
function visibleCueAt<Cue extends { readonly start: number; readonly end: number }>(
  cues: readonly Cue[],
  time: number,
): { readonly cue: Cue; readonly elapsed: number } | null {
  const index = lastStartedIndex(cues, time, (c) => c.start);
  const cue = cues[index];

  if (cue === undefined || time >= cue.end) return null;

  return { cue, elapsed: time - cue.start };
}

function foremanAt(script: FactoryScript, time: number): ForemanFrame {
  const { post, facing } = script.layout.foreman;
  const index = lastStartedIndex(script.foreman, time, (m) => m.start);
  const move: ForemanMove | undefined = script.foreman[index];

  if (move === undefined) {
    return { position: post, heading: facing, activity: "idle", elapsed: time };
  }
  if (time >= move.end) {
    // Between actions the foreman stands where the last one ended, facing the same way.
    return {
      position: move.to,
      heading: move.heading,
      activity: "idle",
      elapsed: time - move.end,
    };
  }

  return {
    position: pointBetween(move.from, move.to, progressOf(move.start, move.end, time)),
    heading: headingAt(move, script.pacing.turnMs, time),
    activity: move.activity,
    elapsed: time - move.since,
  };
}

// Recording time between marks runs evenly; while a worker runs, the recording stands still.
function recordingTimeAt(script: FactoryScript, index: number, time: number): number {
  const mark = script.marks[index];

  if (mark === undefined) return 0;

  const next = script.marks[index + 1];

  if (next === undefined || next.at === mark.at) return mark.recordingTime;

  const progress = Math.min(1, (time - mark.at) / (next.at - mark.at));

  return mark.recordingTime + (next.recordingTime - mark.recordingTime) * progress;
}

/**
 * Computes the factory frame at a scene moment.
 * @param {FactoryScript} script Factory script.
 * @param {number} time Scene moment, ms; outside the scene it clamps to its start or end.
 * @returns {Scene} Frame: workers, foreman, part, prompt, intervention, message, counters and
 * recording time.
 */
export function sceneAt(script: FactoryScript, time: number): Scene {
  const clamped = Math.min(script.duration, Math.max(0, time));
  const workers = STAGES.map((station) => workerAt(script, station, clamped));
  const markIndex = lastStartedIndex(script.marks, clamped, (m) => m.at);
  const mark = script.marks[markIndex];

  return {
    time: clamped,
    recordingTime: recordingTimeAt(script, markIndex, clamped),
    workers,
    part: partAt(script, workers, clamped),
    prompt: visibleCueAt(script.prompts, clamped),
    intervention: visibleCueAt(script.interventions, clamped),
    message: visibleCueAt(script.messages, clamped),
    foreman: foremanAt(script, clamped),
    counts: {
      tokens: mark?.tokens ?? 0,
      prompts: mark?.prompts ?? 0,
      reworks: mark?.reworks ?? 0,
      interventions: mark?.interventions ?? 0,
    },
    finished: clamped >= script.finishAt,
  };
}
