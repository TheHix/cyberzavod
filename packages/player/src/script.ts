// Factory script: a build recording laid out as worker actions in scene time.
// Built once; the frame at any moment is then taken from it by binary search (scene.ts).
//
// Scene time is not recording time. Work at a machine is compressed: a five-hour session plays
// in a couple of minutes. But running and passing the part go at a natural pace, even if stages
// changed within milliseconds in the recording. So the script is built in order: the next handover
// starts when the work is done and the receiver is back at their spot.

import { aisleStop, aisleWalk, type Aisle } from "./aisle.ts";
import { alignMarks } from "./marks.ts";
import {
  distance,
  headingTo,
  stopShortOf,
  WIDE_LAYOUT,
  type FactoryLayout,
  type Point,
} from "./layout.ts";
import {
  briefIntervention,
  briefMessage,
  FOREMAN,
  NO_TALLY,
  succeeded,
  tally,
  type BriefSessionEvent,
  type BriefInterventionEvent,
  type BriefMessageEvent,
  type BriefSessionRecord,
  type PromptEvent,
  type Speaker,
  type Tally,
  STAGES,
  type Stage,
} from "@cyberzavod/core";

/** Scene pacing: how work is compressed and how fast workers move. */
export interface Pacing {
  /** How many times shorter work at a machine is than in the recording. */
  readonly compression: number;
  /** Shortest work at a machine, ms: even an instant stage must be visible. */
  readonly minWorkMs: number;
  /** Longest work at a machine, ms: a long wait for the human does not stall the scene. */
  readonly maxWorkMs: number;
  /** Running speed, layout units per second. */
  readonly walkSpeed: number;
  /** How long passing the part from hand to hand takes, ms. */
  readonly handoffMs: number;
  /** How many layout units short of the receiver the runner stops. */
  readonly handoffGap: number;
  /** How long a worker takes to pick the part up from a machine or put it down, ms. */
  readonly liftMs: number;
  /** How many ms a worker takes to turn to a new direction. */
  readonly turnMs: number;
  /** How long a prompt shows above a worker, ms. */
  readonly promptMs: number;
  /** How long a human intervention shows above the foreman, ms. */
  readonly interventionMs: number;
  /** How long a message shows above the speaker, ms. */
  readonly messageMs: number;
  /** How long the foreman stays at a machine after a talk before going to the office, ms. */
  readonly foremanLingerMs: number;
  /** How long the scene shows the outcome after the build ends, ms. */
  readonly finaleMs: number;
}

/**
 * Default pacing: a minute of recording is a second at the machine, a whole session takes a few
 * minutes.
 */
export const DEFAULT_PACING: Pacing = {
  compression: 60,
  minWorkMs: 1_600,
  maxWorkMs: 8_000,
  walkSpeed: 3.5,
  handoffMs: 500,
  handoffGap: 0.9,
  liftMs: 400,
  turnMs: 200,
  promptMs: 5_000,
  interventionMs: 5_000,
  messageMs: 4_000,
  foremanLingerMs: 5_000,
  finaleMs: 2_500,
};

/** What a worker is busy with. */
export type Activity = "idle" | "work" | "walk" | "handoff";

/**
 * A worker action from `start` to `end` scene ms: what they do, from where to where, with the part
 * or not.
 */
export interface WorkerMove {
  readonly start: number;
  readonly end: number;
  /** When the worker took up this task: for segments of one path, the start of the path. */
  readonly since: number;
  readonly activity: Exclude<Activity, "idle">;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
  /**
   * Where the worker faced at the start of the action: they turn to `heading` within
   * `Pacing.turnMs`.
   */
  readonly turnFrom: number;
  readonly carrying: boolean;
}

/** Part status: in progress, defective after a failed check, done or scrapped. */
export type PartStatus = "ok" | "defect" | "done" | "scrap";

/** Where the part is: on a stage's machine or in the hands of that machine's worker. */
export interface PartPlace {
  readonly on: "machine" | "hands";
  readonly station: Stage;
}

/**
 * From `start` to `end` scene ms the part moves from `from` to `to`: from the machine to hands,
 * from hands to hands, from hands to the machine; after `end` it is at `to`. For a still part
 * `from` and `to` match.
 */
export interface PartMove {
  readonly start: number;
  readonly end: number;
  readonly from: PartPlace;
  readonly to: PartPlace;
  readonly status: PartStatus;
}

/** A human prompt the foreman says to a station's worker, from `start` to `end` scene ms. */
export interface PromptCue {
  readonly start: number;
  readonly end: number;
  readonly station: Stage;
  readonly prompt: PromptEvent;
  /** Index of the prompt in the recording, from zero. */
  readonly index: number;
}

/**
 * A human intervention the foreman says at the station of the current visit, from `start` to `end`
 * scene ms: work at the station stops until the decision.
 */
export interface InterventionCue {
  readonly start: number;
  readonly end: number;
  readonly station: Stage;
  readonly intervention: BriefInterventionEvent;
  /** Index of the intervention in the recording, from zero. */
  readonly index: number;
}

/**
 * A message above the speaker from `start` to `end` scene ms; prompts, interventions and messages
 * go one at a time.
 */
export interface MessageCue {
  readonly start: number;
  readonly end: number;
  readonly speaker: Speaker;
  readonly message: BriefMessageEvent;
  /** Index of the message in the recording, from zero. */
  readonly index: number;
}

/** What the foreman is busy with: standing, walking, talking to a worker or listening to them. */
export type ForemanActivity = "idle" | "walk" | "talk" | "listen";

/** A foreman action from `start` to `end` scene ms: what they do, from where to where. */
export interface ForemanMove {
  readonly start: number;
  readonly end: number;
  /** When the foreman took up this task: for segments of one path, the start of the path. */
  readonly since: number;
  readonly activity: ForemanActivity;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
  /**
   * Where the foreman faced at the start of the action: they turn to `heading` within
   * `Pacing.turnMs`.
   */
  readonly turnFrom: number;
}

/**
 * A mark on the scene timeline: which recording time it matches and the counters at that moment.
 * For speech `at` is the start of its bubble, and `recordingTime` is the event time in the journal.
 */
export interface Mark extends Tally {
  readonly at: number;
  readonly recordingTime: number;
}

/** Factory script: everything that will happen in the scene, by time. */
export interface FactoryScript {
  readonly layout: FactoryLayout;
  readonly pacing: Pacing;
  /** Scene duration, ms. */
  readonly duration: number;
  /** When the build ended and the part got its outcome, scene ms. */
  readonly finishAt: number;
  /** Each worker's actions by time; between them the worker stands at their machine. */
  readonly workers: Readonly<Record<Stage, readonly WorkerMove[]>>;
  readonly part: readonly PartMove[];
  readonly prompts: readonly PromptCue[];
  readonly interventions: readonly InterventionCue[];
  readonly messages: readonly MessageCue[];
  /**
   * The foreman's walks and talks; outside them they stand where the last action ended, and before
   * the first one in the office at the desk, facing `layout.foreman.facing`.
   */
  readonly foreman: readonly ForemanMove[];
  /**
   * Marks in recording order: `at` and `recordingTime` never decrease; for speech `at` is the
   * bubble start.
   */
  readonly marks: readonly Mark[];
}

// A visit is a stretch of the recording while the part lies at one machine.
interface Visit {
  readonly station: Stage;
  readonly from: number;
  readonly to: number;
  /** Visit events that go into the work at the machine: the exchange sounds later. */
  readonly events: readonly BriefSessionEvent[];
  /** All visit events in recording order, the exchange included. */
  readonly recorded: readonly BriefSessionEvent[];
  /** Messages with the worker of the next visit: they sound at the handover spot. */
  readonly exchange: readonly BriefMessageEvent[];
}

// The build outcome for the part: done or scrapped.
type FinalPartStatus = Extract<PartStatus, "done" | "scrap">;

// The part starts its path at the plan machine: the order is taken from it.
const FIRST_STATION: Stage = "planning";

function splitIntoVisits(events: readonly BriefSessionEvent[]): Visit[] {
  const visits: Visit[] = [];
  let station = FIRST_STATION;
  let from = events[0]?.t ?? 0;
  let visitEvents: BriefSessionEvent[] = [];

  for (const event of events) {
    const isNewStation = event.type === "stage_enter" && event.stage !== station;

    if (isNewStation) {
      visits.push({
        station,
        from,
        to: event.t,
        events: visitEvents,
        recorded: visitEvents,
        exchange: [],
      });
      station = event.stage;
      from = event.t;
      visitEvents = [];
    }

    visitEvents.push(event);
  }

  visits.push({
    station,
    from,
    to: events.at(-1)?.t ?? from,
    events: visitEvents,
    recorded: visitEvents,
    exchange: [],
  });

  return visits;
}

function isBetween(message: BriefMessageEvent, a: Stage, b: Stage): boolean {
  return (message.from === a && message.to === b) || (message.from === b && message.to === a);
}

// Speech of a visit other than the giver's talk with the receiver: a prompt, an intervention or a
// message not between stations.
function isOtherSpeech(event: BriefSessionEvent, a: Stage, b: Stage): boolean {
  return (
    event.type === "prompt" ||
    event.type === "intervention" ||
    (event.type === "message" && !isBetween(event, a, b))
  );
}

// The giver's talk with the receiver sounds at the handover spot, not during work: we move it from
// the visit events into the exchange. But only after the visit's last other speech: the bubble
// queue is shared, and an earlier exchange would put speech on the scene out of recording order.
function withExchanges(visits: readonly Visit[]): Visit[] {
  return visits.map((visit, index) => {
    const next = visits[index + 1];

    if (next === undefined) return visit;

    const lastOtherSpeech = visit.events.findLastIndex((event) =>
      isOtherSpeech(event, visit.station, next.station),
    );
    const exchange = visit.events.filter(
      (event, position): event is BriefMessageEvent =>
        position > lastOtherSpeech &&
        event.type === "message" &&
        isBetween(event, visit.station, next.station),
    );
    const spoken = new Set<BriefSessionEvent>(exchange);
    const events = visit.events.filter((event) => !spoken.has(event));

    return { ...visit, events, exchange };
  });
}

function workDuration(recordingMs: number, pacing: Pacing): number {
  const compressed = recordingMs / pacing.compression;

  return Math.min(pacing.maxWorkMs, Math.max(pacing.minWorkMs, compressed));
}

const MS_PER_SECOND = 1_000;

function perStation<T>(value: (stage: Stage) => T): Record<Stage, T> {
  return Object.fromEntries(STAGES.map((stage) => [stage, value(stage)])) as Record<Stage, T>;
}

function machineOf(station: Stage): PartPlace {
  return { on: "machine", station };
}

function handsOf(station: Stage): PartPlace {
  return { on: "hands", station };
}

// A worker action without a turn: the director fills in the starting heading.
type Action = Omit<WorkerMove, "turnFrom">;

// The same for the foreman.
type ForemanAction = Omit<ForemanMove, "turnFrom">;

// A part move without a status: the director fills it in.
type PartTransfer = Omit<PartMove, "status">;

// A worker standing in place: where they started, with the part in hand or not.
interface Standing {
  readonly start: number;
  readonly end: number;
  readonly activity: WorkerMove["activity"];
  readonly at: Point;
  readonly heading: number;
  readonly carrying?: boolean;
}

// A worker's path from moment `start`, with the part in hand or not.
interface Walk {
  readonly worker: Stage;
  readonly route: readonly Point[];
  readonly start: number;
  readonly carrying: boolean;
}

// Hand-to-hand handover at meeting spot `meet`: `start` is when the giver picks up the part,
// `arrive` when they come up, `handover` when the part goes into the receiver's hands, `release`
// when let go.
interface Passing {
  readonly giver: Stage;
  readonly taker: Stage;
  readonly meet: Point;
  readonly start: number;
  readonly arrive: number;
  readonly handover: number;
  readonly release: number;
}

// A part handover: who gives and to whom, when the giver is ready and which messages sound at the
// meeting.
interface Handoff {
  readonly giver: Stage;
  readonly taker: Stage;
  readonly readyAt: number;
  readonly exchange: readonly BriefMessageEvent[];
}

// A path segment: from point to point with a heading.
interface Leg {
  readonly start: number;
  readonly end: number;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
}

// The time a bubble shows: from start to end.
interface Span {
  readonly start: number;
  readonly end: number;
}

// Work spans between pauses: a pause stands while the human's decision is awaited. Pauses come in
// order and may overlap, because bubbles wait in a queue; there are no zero-length spans.
function workSegments(start: number, end: number, pauses: readonly Span[]): Span[] {
  const segments: Span[] = [];
  let from = start;

  for (const pause of pauses) {
    if (pause.start > from) segments.push({ start: from, end: pause.start });

    from = Math.max(from, pause.end);
  }

  if (end > from) segments.push({ start: from, end });

  return segments;
}

// How the foreman takes part in a message: at which station they stand and whether they speak or
// listen.
interface ForemanTalk {
  readonly station: Stage;
  readonly activity: "talk" | "listen";
}

// What the foreman says or hears, at which station, when ready and how long the bubble lasts.
interface ForemanSpeech {
  readonly station: Stage;
  readonly activity: ForemanTalk["activity"];
  readonly readyAt: number;
  readonly duration: number;
}

function foremanTalkIn(message: BriefMessageEvent): ForemanTalk | undefined {
  if (message.from === FOREMAN && message.to !== FOREMAN) {
    return { station: message.to, activity: "talk" };
  }
  if (message.to === FOREMAN && message.from !== FOREMAN) {
    return { station: message.from, activity: "listen" };
  }

  return undefined;
}

// The director lays visits out in scene time. State lives only inside buildScript.
class Director {
  readonly #layout: FactoryLayout;
  readonly #pacing: Pacing;
  // Recording messages in order: a message's index in the journal must not depend on the order they
  // sound.
  readonly #recordedMessages: readonly BriefMessageEvent[];
  readonly #workers = perStation<WorkerMove[]>(() => []);
  // Where the worker faces after their last action: the next turn starts from here.
  readonly #headings: Record<Stage, number>;
  // When the worker is back at their machine: the part cannot be passed to them earlier.
  readonly #homeAt = perStation(() => 0);
  readonly #part: PartMove[] = [];
  readonly #prompts: PromptCue[] = [];
  readonly #interventions: InterventionCue[] = [];
  readonly #messages: MessageCue[] = [];
  readonly #foreman: ForemanMove[] = [];
  // Pauses of the current visit's station: from the share of work the intervention fell on to the
  // bubble end.
  #pauses: Span[] = [];
  // When an event is visible on the scene: for speech, the bubble start; for others, the share of
  // work.
  readonly #shownAt = new Map<BriefSessionEvent, number>();
  // Visits and when their work ended: marks are assembled from them at the end.
  readonly #worked: { readonly visit: Visit; readonly workEnd: number }[] = [];
  #partStatus: PartStatus = "ok";
  #clock = 0;
  // When the last bubble, prompt or message, ended: the next one does not start earlier.
  #speechEnd = 0;
  // Which station the foreman stands at; null means the office.
  #foremanStation: Stage | null = null;
  #foremanHeading: number;
  // When the foreman's last action ended: a new one does not start earlier.
  #foremanBusyUntil = 0;
  // When the foreman last finished speaking: from then on they wait to see if they are called
  // again.
  #foremanFreeAt = 0;

  constructor(layout: FactoryLayout, pacing: Pacing, events: readonly BriefSessionEvent[]) {
    // Own copy of the layout: the script is frozen, while the caller's layout stays theirs.
    this.#layout = structuredClone(layout);
    this.#pacing = pacing;
    this.#recordedMessages = events.filter((event) => event.type === "message");
    this.#headings = perStation((stage) => this.#layout.stations[stage].facing);
    this.#foremanHeading = this.#layout.foreman.facing;
  }

  #act(worker: Stage, action: Action): void {
    this.#workers[worker].push({ ...action, turnFrom: this.#headings[worker] });
    this.#headings[worker] = action.heading;
  }

  #actForeman(action: ForemanAction): void {
    this.#foreman.push({ ...action, turnFrom: this.#foremanHeading });
    this.#foremanHeading = action.heading;
    this.#foremanBusyUntil = action.end;
  }

  #movePart(transfer: PartTransfer): void {
    this.#part.push({ ...transfer, status: this.#partStatus });
  }

  // Work at the machine for the whole visit; visit events fall on the work time proportionally.
  // While people talk at the machine, the work does not end: the part does not leave mid-talk.
  // While the human's decision is awaited, the worker stands: work goes in spans around the pauses.
  work(visit: Visit): number {
    const { station } = visit;
    const plan = this.#layout.stations[station];
    const recordedMs = visit.to - visit.from;
    const start = this.#clock;
    const end = start + workDuration(recordedMs, this.#pacing);

    this.#partStatus = "ok";
    this.#pauses = [];
    this.#movePart({ start, end: start, from: machineOf(station), to: machineOf(station) });

    for (const event of visit.events) {
      const recordedShare = recordedMs === 0 ? 0 : (event.t - visit.from) / recordedMs;
      const at = start + recordedShare * (end - start);

      this.#cue(event, at, station);
    }

    const workEnd = Math.max(end, this.#speechEnd);

    const segments = workSegments(start, workEnd, this.#pauses);

    for (const segment of segments) {
      this.#act(
        station,
        stand({ ...segment, activity: "work", at: plan.post, heading: plan.facing }),
      );
    }

    this.#worked.push({ visit, workEnd });

    return workEnd;
  }

  // What a recording event changes on the scene, besides counters.
  #cue(event: BriefSessionEvent, at: number, station: Stage): void {
    switch (event.type) {
      case "prompt":
        this.#sayPrompt(event, at, station);

        return;
      case "intervention":
        this.#intervene(event, at, station);

        return;
      case "message":
        this.#sayMessage(event, at);

        return;
      case "stage_fail":
        this.#shownAt.set(event, at);
        this.#partStatus = "defect";
        this.#movePart({ start: at, end: at, from: machineOf(station), to: machineOf(station) });

        return;
      case "build_start":
      case "stage_enter":
      case "usage":
      case "build_end":
        this.#shownAt.set(event, at);

        return;
      default:
        // A new event type will not compile until it is decided how it looks on the factory floor.
        event satisfies never;
    }
  }

  // The foreman says a prompt to a station's worker: they come and speak when its turn comes.
  #sayPrompt(prompt: PromptEvent, at: number, station: Stage): void {
    const { start, end } = this.#foremanSpeaks({
      station,
      activity: "talk",
      readyAt: at,
      duration: this.#pacing.promptMs,
    });

    this.#shownAt.set(prompt, start);
    this.#prompts.push({
      start,
      end,
      station,
      prompt: { ...prompt, requirements: [...prompt.requirements] },
      index: this.#prompts.length,
    });
  }

  // The foreman says an intervention to a station's worker, like a prompt; the station stands until
  // the bubble ends.
  #intervene(intervention: BriefInterventionEvent, at: number, station: Stage): void {
    const span = this.#foremanSpeaks({
      station,
      activity: "talk",
      readyAt: at,
      duration: this.#pacing.interventionMs,
    });

    this.#shownAt.set(intervention, span.start);
    this.#pauses.push({ start: at, end: span.end });
    this.#interventions.push({
      ...span,
      station,
      intervention: briefIntervention(intervention),
      index: this.#interventions.length,
    });
  }

  // A message joins the shared queue. If the foreman takes part, they walk to the other party.
  #sayMessage(message: BriefMessageEvent, at: number): Span {
    const { messageMs } = this.#pacing;
    const foremanTalk = foremanTalkIn(message);
    const span =
      foremanTalk === undefined
        ? this.#queueSpeech(at, messageMs)
        : this.#foremanSpeaks({ ...foremanTalk, readyAt: at, duration: messageMs });

    this.#shownAt.set(message, span.start);
    this.#messages.push({
      ...span,
      speaker: message.from,
      message: briefMessage(message),
      index: this.#recordedMessages.indexOf(message),
    });

    return span;
  }

  // Bubbles go one at a time: if the previous one is still showing, this one waits its turn.
  #queueSpeech(readyAt: number, duration: number): Span {
    const start = Math.max(readyAt, this.#speechEnd);
    const end = start + duration;

    this.#speechEnd = end;

    return { start, end };
  }

  // The foreman comes to the station, waits their turn and stands at the worker facing their post
  // while the bubble lasts.
  #foremanSpeaks({ station, activity, readyAt, duration }: ForemanSpeech): Span {
    const { foremanPost, post } = this.#layout.stations[station];
    const span = this.#queueSpeech(this.#comeTo(station, readyAt), duration);

    this.#actForeman({
      ...span,
      since: span.start,
      activity,
      from: foremanPost,
      to: foremanPost,
      heading: headingTo(foremanPost, post),
    });
    this.#foremanFreeAt = span.end;

    return span;
  }

  // The foreman comes to the station by moment `at` and returns when they are there. If there have
  // been no talks for a while, they have gone back to the office and leave from there; otherwise
  // they walk directly.
  #comeTo(station: Stage, at: number): number {
    const departure = this.#foremanFreeAt + this.#pacing.foremanLingerMs;
    const hasLingeredLongEnough = at > departure;

    if (hasLingeredLongEnough) this.#goHome(departure);

    const start = Math.max(at, this.#foremanBusyUntil);

    if (this.#foremanStation === station) return start;

    const { aisle, stations } = this.#layout;
    const target = stations[station].foremanPost;
    const route =
      this.#foremanStation === null
        ? this.#routeFromCabinet(target)
        : routeBetween(stations[this.#foremanStation].foremanPost, target, aisle);

    this.#foremanStation = station;

    return this.#walkForeman(route, start);
  }

  // The foreman returns to the office the way they came and turns to `facing` at the desk.
  #goHome(departure: number): void {
    if (this.#foremanStation === null) return;

    const { post, facing } = this.#layout.foreman;
    const { foremanPost } = this.#layout.stations[this.#foremanStation];
    const route = this.#routeFromCabinet(foremanPost);
    const arrived = this.#walkForeman(route.toReversed(), departure);

    this.#actForeman({
      start: arrived,
      end: arrived + this.#pacing.turnMs,
      since: arrived,
      activity: "idle",
      from: post,
      to: post,
      heading: facing,
    });
    this.#foremanStation = null;
  }

  // The foreman leaves the office around the desk, through the door, and then walks like a worker.
  #routeFromCabinet(target: Point): Point[] {
    const { post, door } = this.#layout.foreman;
    const fromDoor = routeBetween(door, target, this.#layout.aisle);

    return withoutStandstills([post, ...fromDoor]);
  }

  #walkForeman(route: readonly Point[], start: number): number {
    const legs = legsOf(route, start, this.#pacing.walkSpeed);

    for (const leg of legs) {
      this.#actForeman({ ...leg, since: start, activity: "walk" });
    }

    return legs.at(-1)?.end ?? start;
  }

  // A worker takes the part from the machine, carries it to the next one, hands it over and returns
  // to their place; the receiver puts it on their machine. The handover is in front of the
  // receiver, on the aisle side. If the workers talked to each other, it happens at the meeting
  // spot, and the part passes after the talk.
  handOff({ giver, taker, readyAt, exchange }: Handoff): void {
    const { aisle } = this.#layout;
    const { handoffGap, handoffMs } = this.#pacing;
    const giverPost = this.#layout.stations[giver].post;
    const takerPost = this.#layout.stations[taker].post;
    const aisleEntry = aisleStop(aisle, takerPost).point;
    const meet = stopShortOf(aisleEntry, takerPost, handoffGap);
    const route = routeBetween(giverPost, meet, aisle);
    const start = Math.max(readyAt, this.#homeAt[taker]);

    const lifted = this.#liftPart(giver, start);
    const arrive = this.#walk({ worker: giver, route, start: lifted, carrying: true });
    const handover = this.#sayExchange(exchange, arrive);
    const release = handover + handoffMs;

    this.#passPart({ giver, taker, meet, start, arrive, handover, release });

    const placed = this.#placePart(taker, release);

    this.#homeAt[giver] = this.#walk({
      worker: giver,
      route: route.toReversed(),
      start: release,
      carrying: false,
    });
    this.#clock = placed;
  }

  // The giver takes the part from the machine; returns when it is in their hands.
  #liftPart(giver: Stage, start: number): number {
    const { post, facing } = this.#layout.stations[giver];
    const lifted = start + this.#pacing.liftMs;

    this.#act(giver, stand({ start, end: lifted, activity: "handoff", at: post, heading: facing }));
    this.#movePart({ start, end: lifted, from: machineOf(giver), to: handsOf(giver) });

    return lifted;
  }

  // The part passes from hand to hand at the meeting spot. The receiver turns toward the
  // approaching giver in advance and meets them face to face.
  #passPart({ giver, taker, meet, start, arrive, handover, release }: Passing): void {
    const takerPost = this.#layout.stations[taker].post;
    const greet = Math.max(start, arrive - this.#pacing.turnMs);

    this.#act(
      taker,
      stand({
        start: greet,
        end: release,
        activity: "handoff",
        at: takerPost,
        heading: headingTo(takerPost, meet),
      }),
    );
    this.#act(
      giver,
      stand({
        start: arrive,
        end: release,
        activity: "handoff",
        at: meet,
        heading: headingTo(meet, takerPost),
        carrying: true,
      }),
    );
    this.#movePart({ start: handover, end: release, from: handsOf(giver), to: handsOf(taker) });
  }

  // The receiver puts the part on their machine; returns when they are done.
  #placePart(taker: Stage, start: number): number {
    const { post, facing } = this.#layout.stations[taker];
    const placed = start + this.#pacing.liftMs;

    this.#act(
      taker,
      stand({
        start,
        end: placed,
        activity: "handoff",
        at: post,
        heading: facing,
        carrying: true,
      }),
    );
    this.#movePart({ start, end: placed, from: handsOf(taker), to: machineOf(taker) });

    return placed;
  }

  // Messages at the meeting sound one after another; returns when the last one has finished.
  #sayExchange(exchange: readonly BriefMessageEvent[], arrive: number): number {
    let spokenAt = arrive;

    for (const message of exchange) {
      spokenAt = this.#sayMessage(message, arrive).end;
    }

    return spokenAt;
  }

  // A worker's path: each segment is a separate action with its own heading.
  #walk({ worker, route, start, carrying }: Walk): number {
    const legs = legsOf(route, start, this.#pacing.walkSpeed);

    for (const leg of legs) {
      this.#act(worker, { ...leg, since: start, activity: "walk", carrying });
    }

    return legs.at(-1)?.end ?? start;
  }

  // Marks in recording order: each event gets the counters after it and the moment it is visible;
  // after a visit's events, its end. alignMarks aligns marks overtaken by the speech queue.
  #marks(): Mark[] {
    let counts = NO_TALLY;
    const marks: Mark[] = [];

    for (const { visit, workEnd } of this.#worked) {
      for (const event of visit.recorded) {
        counts = tally(counts, event);
        marks.push({ at: this.#shownAtOf(event), recordingTime: event.t, ...counts });
      }

      marks.push({ at: workEnd, recordingTime: visit.to, ...counts });
    }

    return alignMarks(marks);
  }

  #shownAtOf(event: BriefSessionEvent): number {
    const at = this.#shownAt.get(event);

    if (at === undefined) {
      throw new Error(`у события ${event.type} (t=${event.t}) нет момента на сцене`);
    }

    return at;
  }

  finish(station: Stage, at: number, outcome: FinalPartStatus): FactoryScript {
    this.#partStatus = outcome;
    this.#movePart({ start: at, end: at, from: machineOf(station), to: machineOf(station) });
    this.#goHome(this.#foremanFreeAt + this.#pacing.foremanLingerMs);

    return deepFreeze({
      layout: this.#layout,
      pacing: { ...this.#pacing },
      duration: this.#sceneEnd(at),
      finishAt: at,
      workers: this.#workers,
      part: this.#part,
      prompts: this.#prompts,
      interventions: this.#interventions,
      messages: this.#messages,
      foreman: this.#foreman,
      marks: this.#marks(),
    });
  }

  // The scene lasts until the finale ends, the workers return, the bubble queue plays out and
  // the foreman finishes.
  #sceneEnd(finishAt: number): number {
    const workersHomeAt = Math.max(...Object.values(this.#homeAt));
    const finaleEnd = finishAt + this.#pacing.finaleMs;

    return Math.max(finaleEnd, workersHomeAt, this.#speechEnd, this.#foremanBusyUntil);
  }
}

// The script is immutable: frames hand its objects out as they are, and an in-place edit (in the
// interface, for example) would spoil the scene. A frozen object does not let an edit through.
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;

  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);

  return value;
}

// Zero-length path segments drop out: nobody walks them.
function withoutStandstills(points: readonly Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];

    return previous === undefined || distance(previous, point) > 0;
  });
}

// A walker's path: from their spot into the aisle, along the aisle (through its corners) and from
// the aisle to the target, so they never pass through other machines.
function routeBetween(from: Point, to: Point, aisle: Aisle): Point[] {
  const entry = aisleStop(aisle, from);
  const exit = aisleStop(aisle, to);
  const corners = aisleWalk(aisle, entry, exit);

  return withoutStandstills([from, entry.point, ...corners, exit.point, to]);
}

// A path of segments with passing moments at the given speed.
function legsOf(route: readonly Point[], start: number, walkSpeed: number): Leg[] {
  const legs: Leg[] = [];
  let time = start;

  for (const [index, to] of route.entries()) {
    const from = route[index - 1];

    if (from === undefined) continue;

    const end = time + (distance(from, to) / walkSpeed) * MS_PER_SECOND;

    legs.push({ start: time, end, from, to, heading: headingTo(from, to) });
    time = end;
  }

  return legs;
}

function stand({ start, end, activity, at, heading, carrying = false }: Standing): Action {
  return { start, end, since: start, activity, from: at, to: at, heading, carrying };
}

/**
 * Lays a build recording out into worker and foreman actions: who works, runs, passes the part,
 * speaks and listens, and when.
 * @param {BriefSessionRecord} recording Validated build recording.
 * @param {FactoryLayout} layout Factory layout.
 * @param {Pacing} pacing Scene pacing.
 * @returns {FactoryScript} Script from which the frame at any moment is computed.
 */
export function buildScript(
  recording: BriefSessionRecord,
  layout: FactoryLayout = WIDE_LAYOUT,
  pacing: Pacing = DEFAULT_PACING,
): FactoryScript {
  const director = new Director(layout, pacing, recording.data.events);
  const visits = withExchanges(splitIntoVisits(recording.data.events));
  let workEnd = 0;

  for (const [index, visit] of visits.entries()) {
    workEnd = director.work(visit);

    const next = visits[index + 1];

    if (next === undefined) continue;

    director.handOff({
      giver: visit.station,
      taker: next.station,
      readyAt: workEnd,
      exchange: visit.exchange,
    });
  }

  const lastStation = visits.at(-1)?.station ?? FIRST_STATION;
  const outcome = succeeded(recording) ? "done" : "scrap";

  return director.finish(lastStation, workEnd, outcome);
}
