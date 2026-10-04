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
  CONDUCTOR,
  HUMAN,
  NO_TALLY,
  STAGES,
  succeeded,
  tally,
  type BriefFactoryEvent,
  type BriefMessageEvent,
  type BriefRecording,
  type Listener,
  type PromptEvent,
  type Speaker,
  type Stage,
  type Tally,
} from "./recording.ts";
import { progressOf, turned } from "./turn.ts";

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

/** Промпт человека над рабочим, который его получил, от `start` до `end` мс сцены. */
export interface PromptCue {
  readonly start: number;
  readonly end: number;
  readonly station: Stage;
  readonly prompt: PromptEvent;
  /** Номер промпта в записи, с нуля. */
  readonly index: number;
}

/** Реплика над говорящим от `start` до `end` мс сцены; реплики идут по одной. */
export interface MessageCue {
  readonly start: number;
  readonly end: number;
  readonly speaker: Speaker;
  readonly message: BriefMessageEvent;
  /** Номер реплики в записи, с нуля. */
  readonly index: number;
}

/** Мастер от `start` до `end` мс сцены обращён к собеседнику; `talking` — говорит он сам. */
export interface ConductorMove {
  readonly start: number;
  readonly end: number;
  readonly heading: number;
  /** Куда мастер смотрел в начале реплики: к `heading` он поворачивается за `Pacing.turnMs`. */
  readonly turnFrom: number;
  readonly talking: boolean;
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
   * Повороты и речь мастера; вне них он стоит у стола лицом к `layout.conductor.facing`, а после
   * реплики за `Pacing.turnMs` поворачивается к нему обратно.
   */
  readonly conductor: readonly ConductorMove[];
  readonly marks: readonly Mark[];
}

// Визит — отрезок записи, пока деталь лежит у одного станка.
interface Visit {
  readonly station: Stage;
  readonly from: number;
  readonly to: number;
  readonly events: readonly BriefFactoryEvent[];
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
      visits.push({ station, from, to: event.t, events: visitEvents });
      station = event.stage;
      from = event.t;
      visitEvents = [];
    }
    visitEvents.push(event);
  }
  visits.push({ station, from, to: events.at(-1)?.t ?? from, events: visitEvents });
  return visits;
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

// Режиссёр раскладывает визиты по времени сцены. Состояние живёт только внутри buildScript.
class Director {
  readonly #layout: FactoryLayout;
  readonly #pacing: Pacing;
  readonly #workers = perStation<WorkerMove[]>(() => []);
  // Куда смотрит рабочий после последнего действия — с этого начинается следующий поворот.
  readonly #headings: Record<Stage, number>;
  // Когда рабочий снова у своего станка: раньше этого ему нельзя передать деталь.
  readonly #homeAt = perStation(() => 0);
  readonly #part: PartMove[] = [];
  readonly #prompts: PromptCue[] = [];
  readonly #messages: MessageCue[] = [];
  readonly #conductor: ConductorMove[] = [];
  readonly #marks: Mark[] = [];
  #counts: Tally = NO_TALLY;
  #partStatus: PartStatus = "ok";
  #clock = 0;
  // Когда кончилась последняя реплика: следующая не начнётся раньше.
  #messageEnd = 0;

  constructor(layout: FactoryLayout, pacing: Pacing) {
    // Своя копия плана: сценарий замораживается, а план вызывающего кода остаётся его.
    this.#layout = structuredClone(layout);
    this.#pacing = pacing;
    this.#headings = perStation((stage) => this.#layout.stations[stage].facing);
  }

  #act(worker: Stage, action: Action): void {
    this.#workers[worker].push({ ...action, turnFrom: this.#headings[worker] });
    this.#headings[worker] = action.heading;
  }

  #movePart(start: number, end: number, from: PartPlace, to: PartPlace): void {
    this.#part.push({ start, end, from, to, status: this.#partStatus });
  }

  // Работа у станка на весь визит; события визита ложатся на время работы пропорционально.
  work(visit: Visit): number {
    const { station } = visit;
    const plan = this.#layout.stations[station];
    const start = this.#clock;
    const end = start + workDuration(visit.to - visit.from, this.#pacing);
    this.#act(station, stand(start, end, "work", plan.post, plan.facing, false));
    this.#partStatus = "ok";
    this.#movePart(start, start, machineOf(station), machineOf(station));

    const span = visit.to - visit.from;
    for (const event of visit.events) {
      const at = span === 0 ? start : start + ((event.t - visit.from) / span) * (end - start);
      this.#counts = tally(this.#counts, event);
      this.#marks.push({ at, recordingTime: event.t, ...this.#counts });
      this.#cue(event, at, station);
    }
    this.#marks.push({ at: end, recordingTime: visit.to, ...this.#counts });
    return end;
  }

  // Что событие записи меняет на сцене, кроме счётчиков.
  #cue(event: BriefFactoryEvent, at: number, station: Stage): void {
    switch (event.type) {
      case "prompt":
        this.#prompts.push({
          start: at,
          end: at + this.#pacing.promptMs,
          station,
          prompt: { ...event, requirements: [...event.requirements] },
          index: this.#prompts.length,
        });
        return;
      case "message":
        this.#say(event, at);
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

  // Реплики идут по одной: если предыдущая ещё висит, эта ждёт своей очереди. Мастер, если он
  // участвует, поворачивается к собеседнику на время реплики.
  #say(message: BriefMessageEvent, at: number): void {
    const start = Math.max(at, this.#messageEnd);
    const end = start + this.#pacing.messageMs;
    this.#messages.push({
      start,
      end,
      speaker: message.from,
      message: briefMessage(message),
      index: this.#messages.length,
    });
    this.#messageEnd = end;
    this.#turnConductor(message, start, end);
  }

  #turnConductor(message: BriefMessageEvent, start: number, end: number): void {
    const talking = message.from === CONDUCTOR;
    if (!talking && message.to !== CONDUCTOR) return;
    const heading = this.#headingToward(talking ? message.to : message.from);
    this.#conductor.push({
      start,
      end,
      heading,
      turnFrom: this.#conductorHeadingAt(start),
      talking,
    });
  }

  // Куда смотрит мастер в момент t: сразу после реплики — туда же, потом за turnMs он
  // поворачивается в зал, как и в кадре; без реплик — в зал.
  #conductorHeadingAt(t: number): number {
    const { facing } = this.#layout.conductor;
    const previous = this.#conductor.at(-1);
    if (previous === undefined) return facing;
    const back = progressOf(previous.end, previous.end + this.#pacing.turnMs, t);
    return turned(previous.heading, facing, back);
  }

  // Мастер смотрит на пост собеседника, а при разговоре с человеком — в зал, куда глядит у стола.
  #headingToward(interlocutor: Listener): number {
    const { conductor, stations } = this.#layout;
    if (interlocutor === HUMAN || interlocutor === CONDUCTOR) return conductor.facing;
    return headingTo(conductor.post, stations[interlocutor].post);
  }

  // Рабочий берёт деталь со станка, несёт следующему, отдаёт из рук в руки и возвращается
  // к себе; получатель кладёт её на свой станок. Передача — перед получателем, со стороны прохода.
  handOff(giver: Stage, taker: Stage, readyAt: number): void {
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
    const release = arrive + handoffMs;
    // Получатель поворачивается к подходящему заранее и встречает его лицом.
    const greet = Math.max(start, arrive - turnMs);
    const towardGiver = headingTo(takerPlan.post, meet);
    this.#act(taker, stand(greet, release, "handoff", takerPlan.post, towardGiver, false));
    this.#act(
      giver,
      stand(arrive, release, "handoff", meet, headingTo(meet, takerPlan.post), true),
    );
    this.#movePart(arrive, release, handsOf(giver), handsOf(taker));

    const placed = release + liftMs;
    this.#act(taker, stand(release, placed, "handoff", takerPlan.post, takerPlan.facing, true));
    this.#movePart(release, placed, handsOf(taker), machineOf(taker));
    this.#homeAt[giver] = this.#walk(giver, route.toReversed(), release, false);
    this.#clock = placed;
  }

  // Путь из отрезков: каждый — отдельное действие со своим направлением взгляда.
  #walk(worker: Stage, route: readonly Point[], start: number, carrying: boolean): number {
    let time = start;
    for (const [index, to] of route.entries()) {
      const from = route[index - 1];
      if (from === undefined) continue;
      const end = time + (distance(from, to) / this.#pacing.walkSpeed) * MS_PER_SECOND;
      this.#act(worker, {
        start: time,
        end,
        since: start,
        activity: "walk",
        from,
        to,
        heading: headingTo(from, to),
        carrying,
      });
      time = end;
    }
    return time;
  }

  finish(station: Stage, at: number, ok: boolean): FactoryScript {
    this.#partStatus = ok ? "done" : "scrap";
    this.#movePart(at, at, machineOf(station), machineOf(station));
    const lastReturn = Math.max(...Object.values(this.#homeAt));
    return deepFreeze({
      layout: this.#layout,
      pacing: { ...this.#pacing },
      duration: Math.max(at + this.#pacing.finaleMs, lastReturn, this.#messageEnd),
      finishAt: at,
      workers: this.#workers,
      part: this.#part,
      prompts: this.#prompts,
      messages: this.#messages,
      conductor: this.#conductor,
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

// Путь бегущего: со своего места в проход, по проходу и из прохода к получателю —
// так он не пробегает сквозь чужие станки. Отрезки нулевой длины выпадают.
function routeBetween(from: Point, to: Point, aisle: number): Point[] {
  const corners = [from, { x: from.x, y: aisle }, { x: to.x, y: aisle }, to];
  return corners.filter((point, index) => {
    const previous = corners[index - 1];
    return previous === undefined || distance(previous, point) > 0;
  });
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
 * Раскладывает запись сборки на действия рабочих: кто когда работает, бежит и передаёт деталь.
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
  const director = new Director(layout, pacing);
  const visits = splitIntoVisits(recording.events);
  let workEnd = 0;
  let station = FIRST_STATION;
  for (const [index, visit] of visits.entries()) {
    workEnd = director.work(visit);
    station = visit.station;
    const next = visits[index + 1];
    if (next !== undefined) director.handOff(visit.station, next.station, workEnd);
  }
  return director.finish(station, workEnd, succeeded(recording));
}
