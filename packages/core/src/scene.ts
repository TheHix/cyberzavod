// Кадр цеха в момент сцены: где каждый рабочий и мастер, чем заняты, где деталь, какие промпт,
// вмешательство и реплика висят.
// Считается из сценария двоичным поиском, без состояния: перемотка в любую точку бесплатна,
// а кадр стоит O(log n) от длины записи.

import { pointBetween, type Point } from "./layout.ts";
import type { Tally } from "./record.ts";
import { STAGES, type Stage } from "./stage.ts";
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

/** Рабочий в кадре; `elapsed` — сколько мс он уже занят текущим делом, для анимации. */
export interface WorkerFrame {
  readonly station: Stage;
  readonly position: Point;
  readonly heading: number;
  readonly activity: Activity;
  readonly elapsed: number;
  readonly carrying: boolean;
}

/** Деталь в кадре: где она, у чьего станка и в каком состоянии. */
export interface PartFrame {
  readonly position: Point;
  readonly holder: Stage;
  readonly carried: boolean;
  readonly status: PartStatus;
}

/** Промпт, который сейчас висит над рабочим, и сколько мс он уже виден. */
export interface PromptFrame {
  readonly cue: PromptCue;
  readonly elapsed: number;
}

/** Вмешательство, которое мастер сейчас говорит у станции, и сколько мс оно уже видно. */
export interface InterventionFrame {
  readonly cue: InterventionCue;
  readonly elapsed: number;
}

/** Реплика, которая сейчас висит над говорящим, и сколько мс она уже видна. */
export interface MessageFrame {
  readonly cue: MessageCue;
  readonly elapsed: number;
}

/** Мастер в кадре; `elapsed` — сколько мс он уже занят текущим делом, для анимации. */
export interface ForemanFrame {
  readonly position: Point;
  readonly heading: number;
  readonly activity: ForemanActivity;
  readonly elapsed: number;
}

/** Кадр цеха в момент сцены. */
export interface Scene {
  /** Момент сцены, мс. */
  readonly time: number;
  /** Соответствующий момент записи, мс от начала сборки. */
  readonly recordingTime: number;
  /** Рабочие в порядке этапов. */
  readonly workers: readonly WorkerFrame[];
  readonly part: PartFrame;
  readonly prompt: PromptFrame | null;
  readonly intervention: InterventionFrame | null;
  readonly message: MessageFrame | null;
  readonly foreman: ForemanFrame;
  readonly counts: Tally;
  readonly finished: boolean;
}

// Деталь в руках — чуть впереди рабочего, по направлению взгляда.
const CARRY_DISTANCE = 0.45;

/**
 * Номер последнего элемента, начавшегося не позже момента. Элементы отсортированы по началу —
 * так их кладёт сценарий. Наружу пакета не выходит.
 * @param {readonly T[]} items Элементы сценария по возрастанию начала.
 * @param {number} time Момент сцены, мс.
 * @param {(item: T) => number} startOf Начало элемента, мс сцены.
 * @returns {number} Номер элемента; -1, если ни один ещё не начался.
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

function workerAt(script: FactoryScript, station: Stage, time: number): WorkerFrame {
  const moves = script.workers[station];
  const plan = script.layout.stations[station];
  const move: WorkerMove | undefined = moves[lastStartedIndex(moves, time, (m) => m.start)];
  if (move === undefined || time >= move.end) {
    // Между действиями рабочий стоит у своего станка: каждое действие кончается там.
    return {
      station,
      position: plan.post,
      heading: plan.facing,
      activity: "idle",
      elapsed: time - (move?.end ?? 0),
      carrying: false,
    };
  }
  const turn = progressOf(move.start, move.start + script.pacing.turnMs, time);
  return {
    station,
    position: pointBetween(move.from, move.to, progressOf(move.start, move.end, time)),
    heading: turn === 1 ? move.heading : turned(move.turnFrom, move.heading, turn),
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
  const move = script.part[lastStartedIndex(script.part, time, (m) => m.start)];
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

function promptAt(script: FactoryScript, time: number): PromptFrame | null {
  const cue = script.prompts[lastStartedIndex(script.prompts, time, (c) => c.start)];
  if (cue === undefined || time >= cue.end) return null;
  return { cue, elapsed: time - cue.start };
}

function interventionAt(script: FactoryScript, time: number): InterventionFrame | null {
  const cue = script.interventions[lastStartedIndex(script.interventions, time, (c) => c.start)];
  if (cue === undefined || time >= cue.end) return null;
  return { cue, elapsed: time - cue.start };
}

function messageAt(script: FactoryScript, time: number): MessageFrame | null {
  const cue = script.messages[lastStartedIndex(script.messages, time, (c) => c.start)];
  if (cue === undefined || time >= cue.end) return null;
  return { cue, elapsed: time - cue.start };
}

function foremanAt(script: FactoryScript, time: number): ForemanFrame {
  const { post, facing } = script.layout.foreman;
  const move: ForemanMove | undefined =
    script.foreman[lastStartedIndex(script.foreman, time, (m) => m.start)];
  if (move === undefined) {
    return { position: post, heading: facing, activity: "idle", elapsed: time };
  }
  if (time >= move.end) {
    // Между действиями мастер стоит там, где кончилось последнее, лицом туда же.
    return {
      position: move.to,
      heading: move.heading,
      activity: "idle",
      elapsed: time - move.end,
    };
  }
  const turn = progressOf(move.start, move.start + script.pacing.turnMs, time);
  return {
    position: pointBetween(move.from, move.to, progressOf(move.start, move.end, time)),
    heading: turn === 1 ? move.heading : turned(move.turnFrom, move.heading, turn),
    activity: move.activity,
    elapsed: time - move.since,
  };
}

// Время записи между отметками идёт равномерно; пока рабочий бежит, запись стоит.
function recordingTimeAt(script: FactoryScript, index: number, time: number): number {
  const mark = script.marks[index];
  if (mark === undefined) return 0;
  const next = script.marks[index + 1];
  if (next === undefined || next.at === mark.at) return mark.recordingTime;
  const progress = Math.min(1, (time - mark.at) / (next.at - mark.at));
  return mark.recordingTime + (next.recordingTime - mark.recordingTime) * progress;
}

/**
 * Считает кадр цеха в момент сцены.
 * @param {FactoryScript} script Сценарий цеха.
 * @param {number} time Момент сцены, мс; вне сцены прижимается к её началу или концу.
 * @returns {Scene} Кадр: рабочие, мастер, деталь, промпт, вмешательство, реплика, счётчики и время записи.
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
    prompt: promptAt(script, clamped),
    intervention: interventionAt(script, clamped),
    message: messageAt(script, clamped),
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
