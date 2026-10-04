// Сценарий цеха: запись сборки, разложенная на действия рабочих во времени сцены.
// Строится один раз; кадр в любой момент потом берётся из него двоичным поиском (scene.ts).
//
// Время сцены — не время записи. Работа у станка сжимается: пятичасовая сессия идёт
// пару минут. А бег и передача детали идут в естественном темпе, даже если в записи этапы
// сменились за миллисекунды. Поэтому сценарий строится по порядку: следующая передача
// начинается, когда работа закончена и получатель вернулся на своё место.

import {
  distance,
  headingTo,
  stopShortOf,
  DEFAULT_LAYOUT,
  type FactoryLayout,
  type Point,
} from "./layout.ts";
import {
  briefMessage,
  FOREMAN,
  NO_TALLY,
  STAGES,
  succeeded,
  tally,
  type BriefFactoryEvent,
  type BriefMessageEvent,
  type BriefRecording,
  type PromptEvent,
  type Speaker,
  type Stage,
  type Tally,
} from "./recording.ts";

/** Темп сцены: как сжимается работа и как быстро двигаются рабочие. */
export interface Pacing {
  /** Во сколько раз работа у станка короче, чем в записи. */
  readonly compression: number;
  /** Самая короткая работа у станка, мс: даже мгновенный этап должно быть видно. */
  readonly minWorkMs: number;
  /** Самая долгая работа у станка, мс: долгое ожидание человека не тормозит сцену. */
  readonly maxWorkMs: number;
  /** Скорость бега, единиц плана в секунду. */
  readonly walkSpeed: number;
  /** Сколько длится передача детали из рук в руки, мс. */
  readonly handoffMs: number;
  /** За сколько единиц плана до получателя останавливается бегущий. */
  readonly handoffGap: number;
  /** Сколько рабочий берёт деталь со станка или кладёт на него, мс. */
  readonly liftMs: number;
  /** За сколько мс рабочий разворачивается в новую сторону. */
  readonly turnMs: number;
  /** Сколько промпт висит над рабочим, мс. */
  readonly promptMs: number;
  /** Сколько реплика висит над говорящим, мс. */
  readonly messageMs: number;
  /** Сколько мастер стоит у станка после разговора, прежде чем уйти в кабинет, мс. */
  readonly foremanLingerMs: number;
  /** Сколько сцена показывает итог после конца сборки, мс. */
  readonly finaleMs: number;
}

/** Темп по умолчанию: минута записи — секунда у станка, вся сессия идёт несколько минут. */
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
  messageMs: 4_000,
  foremanLingerMs: 5_000,
  finaleMs: 2_500,
};

/** Чем занят рабочий. */
export type Activity = "idle" | "work" | "walk" | "handoff";

/** Действие рабочего от `start` до `end` мс сцены: что делает, откуда и куда, с деталью ли. */
export interface WorkerMove {
  readonly start: number;
  readonly end: number;
  /** Когда рабочий взялся за это дело: у отрезков одного пути — начало пути. */
  readonly since: number;
  readonly activity: Exclude<Activity, "idle">;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
  /** Куда рабочий смотрел в начале действия: к `heading` он поворачивается за `Pacing.turnMs`. */
  readonly turnFrom: number;
  readonly carrying: boolean;
}

/** Состояние детали: в работе, с браком после проваленной проверки, готова или списана. */
export type PartStatus = "ok" | "defect" | "done" | "scrap";

/** Где деталь: на станке этапа или в руках рабочего этого станка. */
export interface PartPlace {
  readonly on: "machine" | "hands";
  readonly station: Stage;
}

/**
 * С `start` до `end` мс сцены деталь переходит из `from` в `to` — со станка в руки, из рук
 * в руки, из рук на станок; после `end` она в `to`. У неподвижной детали `from` и `to` совпадают.
 */
export interface PartMove {
  readonly start: number;
  readonly end: number;
  readonly from: PartPlace;
  readonly to: PartPlace;
  readonly status: PartStatus;
}

/** Промпт человека, который мастер говорит рабочему станции, от `start` до `end` мс сцены. */
export interface PromptCue {
  readonly start: number;
  readonly end: number;
  readonly station: Stage;
  readonly prompt: PromptEvent;
  /** Номер промпта в записи, с нуля. */
  readonly index: number;
}

/** Реплика над говорящим от `start` до `end` мс сцены; промпты и реплики идут по одному. */
export interface MessageCue {
  readonly start: number;
  readonly end: number;
  readonly speaker: Speaker;
  readonly message: BriefMessageEvent;
  /** Номер реплики в записи, с нуля. */
  readonly index: number;
}

/** Чем занят мастер: стоит, идёт, говорит рабочему или слушает его. */
export type ForemanActivity = "idle" | "walk" | "talk" | "listen";

/** Действие мастера от `start` до `end` мс сцены: что делает, откуда и куда. */
export interface ForemanMove {
  readonly start: number;
  readonly end: number;
  /** Когда мастер взялся за это дело: у отрезков одного пути — начало пути. */
  readonly since: number;
  readonly activity: ForemanActivity;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
  /** Куда мастер смотрел в начале действия: к `heading` он поворачивается за `Pacing.turnMs`. */
  readonly turnFrom: number;
}

/** Отметка на шкале сцены: какое время записи ей соответствует и счётчики на этот момент. */
export interface Mark extends Tally {
  readonly at: number;
  readonly recordingTime: number;
}

/** Сценарий цеха: всё, что произойдёт в сцене, по времени. */
export interface FactoryScript {
  readonly layout: FactoryLayout;
  readonly pacing: Pacing;
  /** Длительность сцены, мс. */
  readonly duration: number;
  /** Когда сборка закончилась и деталь получила итог, мс сцены. */
  readonly finishAt: number;
  /** Действия каждого рабочего по времени; между ними рабочий стоит у своего станка. */
  readonly workers: Readonly<Record<Stage, readonly WorkerMove[]>>;
  readonly part: readonly PartMove[];
  readonly prompts: readonly PromptCue[];
  readonly messages: readonly MessageCue[];
  /**
   * Ходьба и разговоры мастера; вне них он стоит там, где кончилось последнее действие, а до
   * первого — в кабинете у стола лицом к `layout.foreman.facing`.
   */
  readonly foreman: readonly ForemanMove[];
  readonly marks: readonly Mark[];
}

// Визит — отрезок записи, пока деталь лежит у одного станка.
interface Visit {
  readonly station: Stage;
  readonly from: number;
  readonly to: number;
  readonly events: readonly BriefFactoryEvent[];
  /** Реплики с рабочим следующего визита: они звучат у места передачи детали. */
  readonly exchange: readonly BriefMessageEvent[];
}

// Деталь начинает путь у станка постановки: с него берут заказ.
const FIRST_STATION: Stage = "spec";

function splitIntoVisits(events: readonly BriefFactoryEvent[]): Visit[] {
  const visits: Visit[] = [];
  let station = FIRST_STATION;
  let from = events[0]?.t ?? 0;
  let visitEvents: BriefFactoryEvent[] = [];
  for (const event of events) {
    if (event.type === "stage_enter" && event.stage !== station) {
      visits.push({ station, from, to: event.t, events: visitEvents, exchange: [] });
      station = event.stage;
      from = event.t;
      visitEvents = [];
    }
    visitEvents.push(event);
  }
  visits.push({ station, from, to: events.at(-1)?.t ?? from, events: visitEvents, exchange: [] });
  return visits;
}

function isBetween(message: BriefMessageEvent, a: Stage, b: Stage): boolean {
  return (message.from === a && message.to === b) || (message.from === b && message.to === a);
}

// Разговор отдающего с получателем звучит у места передачи, а не в работе: переносим его из
// событий визита в обмен.
function withExchanges(visits: readonly Visit[]): Visit[] {
  return visits.map((visit, index) => {
    const next = visits[index + 1];
    if (next === undefined) return visit;
    const exchange = visit.events.flatMap((event) =>
      event.type === "message" && isBetween(event, visit.station, next.station) ? [event] : [],
    );
    const spoken = new Set<BriefFactoryEvent>(exchange);
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

// Действие рабочего без поворота: направление в начале проставляет режиссёр.
type Action = Omit<WorkerMove, "turnFrom">;

// То же для мастера.
type ForemanAction = Omit<ForemanMove, "turnFrom">;

// Отрезок пути: от точки до точки с направлением взгляда.
interface Leg {
  readonly start: number;
  readonly end: number;
  readonly from: Point;
  readonly to: Point;
  readonly heading: number;
}

// Время, когда пузырь висит: от начала до конца.
interface Span {
  readonly start: number;
  readonly end: number;
}

// Как мастер участвует в реплике: у какой станции стоит и говорит он или слушает.
interface ForemanTalk {
  readonly station: Stage;
  readonly activity: "talk" | "listen";
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

// Режиссёр раскладывает визиты по времени сцены. Состояние живёт только внутри buildScript.
class Director {
  readonly #layout: FactoryLayout;
  readonly #pacing: Pacing;
  // Реплики записи по порядку: номер реплики в журнале не должен зависеть от порядка звучания.
  readonly #recordedMessages: readonly BriefMessageEvent[];
  readonly #workers = perStation<WorkerMove[]>(() => []);
  // Куда смотрит рабочий после последнего действия — с этого начинается следующий поворот.
  readonly #headings: Record<Stage, number>;
  // Когда рабочий снова у своего станка: раньше этого ему нельзя передать деталь.
  readonly #homeAt = perStation(() => 0);
  readonly #part: PartMove[] = [];
  readonly #prompts: PromptCue[] = [];
  readonly #messages: MessageCue[] = [];
  readonly #foreman: ForemanMove[] = [];
  readonly #marks: Mark[] = [];
  #counts: Tally = NO_TALLY;
  #partStatus: PartStatus = "ok";
  #clock = 0;
  // Когда кончился последний пузырь, промпт или реплика: следующий не начнётся раньше.
  #speechEnd = 0;
  // У какой станции стоит мастер; null — в кабинете.
  #foremanStation: Stage | null = null;
  #foremanHeading: number;
  // Когда кончилось последнее действие мастера: новое не начнётся раньше.
  #foremanBusyUntil = 0;
  // Когда мастер договорил последний раз: от этого момента он ждёт, не позовут ли снова.
  #foremanFreeAt = 0;

  constructor(layout: FactoryLayout, pacing: Pacing, events: readonly BriefFactoryEvent[]) {
    // Своя копия плана: сценарий замораживается, а план вызывающего кода остаётся его.
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

  #movePart(start: number, end: number, from: PartPlace, to: PartPlace): void {
    this.#part.push({ start, end, from, to, status: this.#partStatus });
  }

  // Работа у станка на весь визит; события визита ложатся на время работы пропорционально.
  // Пока у станка говорят, работа не кончается: деталь не уходит посреди разговора.
  work(visit: Visit): number {
    const { station } = visit;
    const plan = this.#layout.stations[station];
    const start = this.#clock;
    const end = start + workDuration(visit.to - visit.from, this.#pacing);
    this.#partStatus = "ok";
    this.#movePart(start, start, machineOf(station), machineOf(station));

    const span = visit.to - visit.from;
    for (const event of visit.events) {
      const at = span === 0 ? start : start + ((event.t - visit.from) / span) * (end - start);
      this.#counts = tally(this.#counts, event);
      this.#marks.push({ at, recordingTime: event.t, ...this.#counts });
      this.#cue(event, at, station);
    }
    const workEnd = Math.max(end, this.#speechEnd);
    this.#act(station, stand(start, workEnd, "work", plan.post, plan.facing, false));
    this.#marks.push({ at: workEnd, recordingTime: visit.to, ...this.#counts });
    return workEnd;
  }

  // Что событие записи меняет на сцене, кроме счётчиков.
  #cue(event: BriefFactoryEvent, at: number, station: Stage): void {
    switch (event.type) {
      case "prompt":
        this.#sayPrompt(event, at, station);
        return;
      case "message":
        this.#sayMessage(event, at);
        return;
      case "stage_fail":
        this.#partStatus = "defect";
        this.#movePart(at, at, machineOf(station), machineOf(station));
        return;
      case "build_start":
      case "stage_enter":
      case "usage":
      case "build_end":
        return;
      default:
        // Новый тип события не скомпилируется, пока не решат, как он выглядит в цехе.
        event satisfies never;
    }
  }

  // Промпт говорит мастер рабочему станции: он приходит и говорит, когда дойдёт его очередь.
  #sayPrompt(prompt: PromptEvent, at: number, station: Stage): void {
    const { start, end } = this.#foremanSpeaks(station, "talk", at, this.#pacing.promptMs);
    this.#prompts.push({
      start,
      end,
      station,
      prompt: { ...prompt, requirements: [...prompt.requirements] },
      index: this.#prompts.length,
    });
  }

  // Реплика встаёт в общую очередь. Если в ней участвует мастер, он идёт к собеседнику.
  #sayMessage(message: BriefMessageEvent, at: number): Span {
    const { messageMs } = this.#pacing;
    const foremanTalk = foremanTalkIn(message);
    const span =
      foremanTalk === undefined
        ? this.#queueSpeech(at, messageMs)
        : this.#foremanSpeaks(foremanTalk.station, foremanTalk.activity, at, messageMs);
    this.#messages.push({
      ...span,
      speaker: message.from,
      message: briefMessage(message),
      index: this.#recordedMessages.indexOf(message),
    });
    return span;
  }

  // Пузыри идут по одному: если предыдущий ещё висит, этот ждёт своей очереди.
  #queueSpeech(readyAt: number, duration: number): Span {
    const start = Math.max(readyAt, this.#speechEnd);
    const end = start + duration;
    this.#speechEnd = end;
    return { start, end };
  }

  // Мастер приходит к станции, ждёт очереди и стоит у рабочего лицом к его посту, пока идёт пузырь.
  #foremanSpeaks(
    station: Stage,
    activity: ForemanTalk["activity"],
    at: number,
    duration: number,
  ): Span {
    const { foremanPost, post } = this.#layout.stations[station];
    const span = this.#queueSpeech(this.#comeTo(station, at), duration);
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

  // Мастер приходит к станции к моменту `at` и возвращает, когда он на месте. Если разговоров
  // давно не было, он успел вернуться в кабинет и выходит оттуда; иначе идёт напрямую.
  #comeTo(station: Stage, at: number): number {
    const departure = this.#foremanFreeAt + this.#pacing.foremanLingerMs;
    if (this.#foremanStation !== null && at > departure) this.#goHome(departure);
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

  // Мастер возвращается в кабинет тем же путём, каким пришёл, и у стола поворачивается к `facing`.
  #goHome(departure: number): void {
    if (this.#foremanStation === null) return;
    const { post, facing } = this.#layout.foreman;
    const route = this.#routeFromCabinet(this.#layout.stations[this.#foremanStation].foremanPost);
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

  // Из кабинета мастер выходит в обход стола, через дверь, а дальше идёт как рабочий.
  #routeFromCabinet(target: Point): Point[] {
    const { post, door } = this.#layout.foreman;
    return withoutStandstills([post, ...routeBetween(door, target, this.#layout.aisle)]);
  }

  #walkForeman(route: readonly Point[], start: number): number {
    const legs = legsOf(route, start, this.#pacing.walkSpeed);
    for (const leg of legs) {
      this.#actForeman({ ...leg, since: start, activity: "walk" });
    }
    return legs.at(-1)?.end ?? start;
  }

  // Рабочий берёт деталь со станка, несёт следующему, отдаёт из рук в руки и возвращается
  // к себе; получатель кладёт её на свой станок. Передача — перед получателем, со стороны прохода.
  // Если рабочие говорили между собой, то у места встречи, и деталь переходит после разговора.
  handOff(
    giver: Stage,
    taker: Stage,
    readyAt: number,
    exchange: readonly BriefMessageEvent[],
  ): void {
    const { aisle } = this.#layout;
    const { handoffGap, handoffMs, liftMs, turnMs } = this.#pacing;
    const giverPlan = this.#layout.stations[giver];
    const takerPlan = this.#layout.stations[taker];
    const meet = stopShortOf({ x: takerPlan.post.x, y: aisle }, takerPlan.post, handoffGap);
    const route = routeBetween(giverPlan.post, meet, aisle);
    const start = Math.max(readyAt, this.#homeAt[taker]);

    const lifted = start + liftMs;
    this.#act(giver, stand(start, lifted, "handoff", giverPlan.post, giverPlan.facing, false));
    this.#movePart(start, lifted, machineOf(giver), handsOf(giver));

    const arrive = this.#walk(giver, route, lifted, true);
    let handover = arrive;
    for (const message of exchange) handover = this.#sayMessage(message, arrive).end;
    const release = handover + handoffMs;
    // Получатель поворачивается к подходящему заранее и встречает его лицом.
    const greet = Math.max(start, arrive - turnMs);
    const towardGiver = headingTo(takerPlan.post, meet);
    this.#act(taker, stand(greet, release, "handoff", takerPlan.post, towardGiver, false));
    this.#act(
      giver,
      stand(arrive, release, "handoff", meet, headingTo(meet, takerPlan.post), true),
    );
    this.#movePart(handover, release, handsOf(giver), handsOf(taker));

    const placed = release + liftMs;
    this.#act(taker, stand(release, placed, "handoff", takerPlan.post, takerPlan.facing, true));
    this.#movePart(release, placed, handsOf(taker), machineOf(taker));
    this.#homeAt[giver] = this.#walk(giver, route.toReversed(), release, false);
    this.#clock = placed;
  }

  // Путь рабочего: каждый отрезок — отдельное действие со своим направлением взгляда.
  #walk(worker: Stage, route: readonly Point[], start: number, carrying: boolean): number {
    const legs = legsOf(route, start, this.#pacing.walkSpeed);
    for (const leg of legs) {
      this.#act(worker, { ...leg, since: start, activity: "walk", carrying });
    }
    return legs.at(-1)?.end ?? start;
  }

  finish(station: Stage, at: number, ok: boolean): FactoryScript {
    this.#partStatus = ok ? "done" : "scrap";
    this.#movePart(at, at, machineOf(station), machineOf(station));
    this.#goHome(this.#foremanFreeAt + this.#pacing.foremanLingerMs);
    const lastReturn = Math.max(...Object.values(this.#homeAt));
    return deepFreeze({
      layout: this.#layout,
      pacing: { ...this.#pacing },
      duration: Math.max(
        at + this.#pacing.finaleMs,
        lastReturn,
        this.#speechEnd,
        this.#foremanBusyUntil,
      ),
      finishAt: at,
      workers: this.#workers,
      part: this.#part,
      prompts: this.#prompts,
      messages: this.#messages,
      foreman: this.#foreman,
      marks: this.#marks,
    });
  }
}

// Сценарий неизменяем: кадры отдают его объекты наружу как есть, и правка на месте —
// например, в интерфейсе — испортила бы сцену. Замороженный объект правку не пропустит.
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

// Отрезки нулевой длины в пути выпадают: по ним никто не идёт.
function withoutStandstills(points: readonly Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || distance(previous, point) > 0;
  });
}

// Путь идущего: со своего места в проход, по проходу и из прохода к цели — так он не проходит
// сквозь чужие станки.
function routeBetween(from: Point, to: Point, aisle: number): Point[] {
  return withoutStandstills([from, { x: from.x, y: aisle }, { x: to.x, y: aisle }, to]);
}

// Путь из отрезков с моментами прохождения при заданной скорости.
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

function stand(
  start: number,
  end: number,
  activity: WorkerMove["activity"],
  at: Point,
  heading: number,
  carrying: boolean,
): Action {
  return { start, end, since: start, activity, from: at, to: at, heading, carrying };
}

/**
 * Раскладывает запись сборки на действия рабочих и мастера: кто когда работает, бежит,
 * передаёт деталь, говорит и слушает.
 * @param {BriefRecording} recording Проверенная запись сборки.
 * @param {FactoryLayout} layout План цеха.
 * @param {Pacing} pacing Темп сцены.
 * @returns {FactoryScript} Сценарий, по которому считается кадр в любой момент.
 */
export function buildScript(
  recording: BriefRecording,
  layout: FactoryLayout = DEFAULT_LAYOUT,
  pacing: Pacing = DEFAULT_PACING,
): FactoryScript {
  const director = new Director(layout, pacing, recording.events);
  const visits = withExchanges(splitIntoVisits(recording.events));
  let workEnd = 0;
  let station = FIRST_STATION;
  for (const [index, visit] of visits.entries()) {
    workEnd = director.work(visit);
    station = visit.station;
    const next = visits[index + 1];
    if (next !== undefined) director.handOff(visit.station, next.station, workEnd, visit.exchange);
  }
  return director.finish(station, workEnd, succeeded(recording));
}
