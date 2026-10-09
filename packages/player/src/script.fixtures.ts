// Shared data for the script and frame tests.

import { FACTORY_LAYOUTS, type FactoryLayout, type StationPlan } from "./layout.ts";
import {
  type SessionEvent,
  type MessageEvent,
  type SessionRecord,
  type Speaker,
} from "@cyberzavod/core";
import { DEFAULT_PACING, type Pacing } from "./script.ts";

// Machines in a row 10 units apart, the aisle two units from the posts, running at one unit per
// second, work at a machine lasts as long as in the recording: scene moments can be computed in
// your head. Handover to a neighbor: 0.2 s to lift the part, 13 s of path (2 down into the aisle,
// 10 along the aisle, 1 up to the receiver), 0.1 s hand to hand, 0.2 s for the receiver to put it
// on the machine.

const AISLE = 2;

/**
 * Machine for tests: the post at the point, the machine one unit further from the aisle, the
 * foreman stands three units to the right of the worker.
 * @param {number} x Horizontal position.
 * @param {number} y Vertical position of the post.
 * @returns {StationPlan} A machine whose worker faces it.
 */
export function stationAt(x: number, y = 0): StationPlan {
  const toMachine = y > AISLE ? 1 : -1;

  return {
    machine: { x, y: y + toMachine },
    post: { x, y },
    facing: (toMachine * Math.PI) / 2,
    foremanPost: { x: x + 3, y },
  };
}

/** Layout for tests: machines in a row 10 units apart, the aisle two units from them. */
export const LINE_LAYOUT: FactoryLayout = {
  width: 50,
  height: 10,
  minFieldAspect: 0,
  minScreenAspect: 0,
  aisle: [
    { x: -10, y: AISLE },
    { x: 60, y: AISLE },
  ],
  stations: {
    planning: stationAt(0),
    implementation: stationAt(10),
    verification: stationAt(20),
    review: stationAt(30),
    record: stationAt(40),
  },
  foreman: {
    desk: { x: 20, y: 5 },
    post: { x: 20, y: 6 },
    facing: -Math.PI / 2,
    door: { x: 22, y: 6 },
  },
};

/** Pacing for tests: no compression, running at one unit per second. */
export const PLAIN_PACING: Pacing = {
  compression: 1,
  minWorkMs: 0,
  maxWorkMs: Number.POSITIVE_INFINITY,
  walkSpeed: 1,
  handoffMs: 100,
  handoffGap: 1,
  liftMs: 200,
  turnMs: 150,
  promptMs: 1_000,
  interventionMs: 1_000,
  messageMs: 1_000,
  foremanLingerMs: 500,
  finaleMs: 500,
};

/**
 * Recording for tests without talks: plan → code → checks with a failure → code again.
 * @param {boolean} ok Build outcome.
 * @returns {SessionRecord} Build recording.
 */
export function reworkRecording(ok = true): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    { t: 2_000, type: "stage_enter", stage: "implementation" },
    { t: 5_000, type: "stage_enter", stage: "verification" },
    { t: 6_000, type: "stage_fail", stage: "verification", reason: "проверки не прошли" },
    { t: 6_000, type: "stage_enter", stage: "implementation" },
    { t: 7_000, type: "usage", tokens: 1_200 },
    { t: 8_000, type: "build_end", ok },
  ];

  return {
    version: 1,
    type: "session",
    id: "test",
    timestamp: "2026-10-04T00:00:00.000Z",
    projectId: "test",
    source: { type: "manual" },
    data: { title: "Тест", language: "ru", workflow: "default", harness: "0.0.0", events },
  };
}

/**
 * The same session with other events.
 * @param {SessionRecord} session Session from which everything but the events is taken.
 * @param {SessionEvent[]} events New events.
 * @returns {SessionRecord} New session.
 */
export function withEvents(session: SessionRecord, events: SessionEvent[]): SessionRecord {
  return { ...session, data: { ...session.data, events } };
}

/**
 * Message for tests: the line and the full text are derived from the moment.
 * @param {number} t Recording time, ms.
 * @param {Speaker} from Who speaks.
 * @param {Speaker} to Who it is addressed to.
 * @returns {MessageEvent} Message.
 */
export function messageAt(t: number, from: Speaker, to: Speaker): MessageEvent {
  return { t, type: "message", from, to, line: `Реплика ${t}`, text: `Полный текст ${t}` };
}

/**
 * Recording for tests with messages: a prompt and the worker's "got it" at the plan machine, at the
 * code machine the foreman listening and the code–checks exchange at handover, at the checks
 * machine a report to the foreman.
 * @returns {SessionRecord} Build recording.
 */
export function chatRecording(): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    { t: 500, type: "prompt", goal: "Добавь счётчик", requirements: [] },
    messageAt(600, "planning", "foreman"),
    { t: 1_000, type: "stage_enter", stage: "implementation" },
    messageAt(1_500, "implementation", "foreman"),
    messageAt(3_000, "implementation", "verification"),
    messageAt(3_500, "verification", "implementation"),
    { t: 4_000, type: "stage_enter", stage: "verification" },
    messageAt(5_000, "verification", "foreman"),
    { t: 8_000, type: "build_end", ok: true },
  ];

  return withEvents(reworkRecording(), events);
}

/**
 * Recording for tests with an exchange on rework with a defect: checks and code talk to each other
 * before and after the failure, and the part goes back for rework with that talk.
 * @returns {SessionRecord} Build recording.
 */
export function defectExchangeRecording(): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    { t: 100, type: "stage_enter", stage: "verification" },
    messageAt(1_500, "verification", "implementation"),
    { t: 1_600, type: "stage_fail", stage: "verification", reason: "проверки не прошли" },
    messageAt(1_700, "implementation", "verification"),
    { t: 2_000, type: "stage_enter", stage: "implementation" },
    { t: 3_000, type: "build_end", ok: true },
  ];

  return withEvents(reworkRecording(), events);
}

/**
 * Recording for tests with a code message to checks before other speech of the visit: it sounds at
 * the machine, not at the meeting spot, and the exchange keeps only the message after the prompt
 * and the foreman's words.
 * @returns {SessionRecord} Build recording.
 */
export function earlyExchangeRecording(): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    { t: 100, type: "stage_enter", stage: "implementation" },
    messageAt(500, "implementation", "verification"),
    { t: 600, type: "prompt", goal: "Добавь счётчик", requirements: ["Над цехом"] },
    messageAt(700, "foreman", "implementation"),
    messageAt(900, "verification", "implementation"),
    { t: 1_000, type: "stage_enter", stage: "verification" },
    { t: 2_000, type: "build_end", ok: true },
  ];

  return withEvents(reworkRecording(), events);
}

/**
 * Recording for tests with a human intervention: checks failed, review stopped, and
 * the foreman decides what to do next, and then review continues.
 * @returns {SessionRecord} Build recording.
 */
export function interventionRecording(): SessionRecord {
  const events: SessionEvent[] = [
    { t: 0, type: "build_start" },
    { t: 1_000, type: "stage_enter", stage: "verification" },
    { t: 2_000, type: "stage_fail", stage: "verification", reason: "проверки не прошли" },
    { t: 2_000, type: "stage_enter", stage: "review" },
    {
      t: 4_000,
      type: "intervention",
      reason: "rework_limit",
      line: "Откати кэш, сделай без него",
      text: "Откати кэш и сделай без него.\n\nПроверки тогда пройдут.",
    },
    messageAt(6_000, "review", "foreman"),
    { t: 10_000, type: "build_end", ok: true },
  ];

  return withEvents(reworkRecording(), events);
}

/** Recordings with speech for timing tests: with an exchange at handover and without. */
export const SPEECH_RECORDINGS: readonly {
  readonly name: string;
  readonly recording: SessionRecord;
}[] = [
  { name: "с мастером и обменом", recording: chatRecording() },
  { name: "с обменом при возврате с браком", recording: defectExchangeRecording() },
  { name: "с репликой перед другой речью", recording: earlyExchangeRecording() },
  { name: "с вмешательством человека", recording: interventionRecording() },
];

/**
 * Layout and pacing for tests: a test-specific one and each factory layout at the default pacing.
 */
export const PLAYBACK_SETUPS: readonly {
  readonly name: string;
  readonly layout: FactoryLayout;
  readonly pacing: Pacing;
}[] = [
  { name: "линейный", layout: LINE_LAYOUT, pacing: PLAIN_PACING },
  ...FACTORY_LAYOUTS.map((layout) => ({
    name: `${layout.width}×${layout.height}`,
    layout,
    pacing: DEFAULT_PACING,
  })),
];
