import { describe, expect, it } from "vitest";
import { sceneAt } from "./scene.ts";
import { headingTo } from "./layout.ts";
import {
  chatRecording,
  interventionRecording,
  LINE_LAYOUT,
  messageAt,
  PLAIN_PACING,
  PLAYBACK_SETUPS,
  reworkRecording,
  SPEECH_RECORDINGS,
  withEvents,
} from "./script.fixtures.ts";
import { buildScript, type FactoryScript } from "./script.ts";

// Scene moments for reworkRecording, see the buildScript tests: plan works 0–2,000, lifts the part
// until 2,200, carries it to code (along the aisle 4,200–14,200), hands it over 15,200–15,300; code
// turns toward it from 15,050, puts the part down until 15,500 and works 15,500–18,500.
function reworkScript(): FactoryScript {
  return buildScript(reworkRecording(), LINE_LAYOUT, PLAIN_PACING);
}

describe("sceneAt", () => {
  it("ведёт бегущего рабочего с деталью в руках", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 9_200);

    expect({ worker: scene.workers[0], part: scene.part }).toEqual({
      worker: {
        station: "planning",
        position: { x: 5, y: 2 },
        heading: 0,
        activity: "walk",
        elapsed: 7_000,
        carrying: true,
      },
      part: { position: { x: 5.45, y: 2 }, holder: "planning", carried: true, status: "ok" },
    });
  });

  it("разворачивает получателя к тому, кто принёс деталь", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 15_250);

    expect(scene.workers[1]).toMatchObject({ activity: "handoff", heading: Math.PI / 2 });
  });

  it("разворачивает рабочего плавно, а не рывком", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 15_125);

    // Halfway from "toward the machine" (−π/2) to "toward the aisle" (π/2).
    expect(scene.workers[1]?.heading).toBeCloseTo(0);
  });

  it("поворачивает по кратчайшей дуге, даже через ±π", () => {
    const script = reworkScript();

    // The checks worker runs left along the aisle (π) and from 57,000 turns up (−π/2):
    // halfway through the turn that is 5π/4, not π/4 as it would be going around through zero.
    const scene = sceneAt(script, 57_075);

    expect(scene.workers[3]?.heading).toBeCloseTo(1.25 * Math.PI);
  });

  it("передаёт деталь из рук в руки, а не перескоком", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 15_250);

    // Midway between the giver's hands (y = 0.55) and the receiver's (y = 0.45).
    expect([scene.part.position.x, scene.part.position.y, scene.part.holder]).toEqual([
      10,
      expect.closeTo(0.5),
      "implementation",
    ]);
  });

  it("держит свободного рабочего у его станка лицом к станку", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 5_000);

    expect(scene.workers[3]).toEqual({
      station: "verification",
      position: { x: 20, y: 0 },
      heading: -Math.PI / 2,
      activity: "idle",
      elapsed: 5_000,
      carrying: false,
    });
  });

  it("кладёт деталь на станок, у которого работают", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 16_000);

    expect({ worker: scene.workers[1]?.activity, part: scene.part }).toEqual({
      worker: "work",
      part: { position: { x: 10, y: -1 }, holder: "implementation", carried: false, status: "ok" },
    });
  });

  it.each([
    [500, { tokens: 0, prompts: 0, reworks: 0, interventions: 0 }],
    [40_000, { tokens: 0, prompts: 0, reworks: 1, interventions: 0 }],
    [71_000, { tokens: 1_200, prompts: 0, reworks: 1, interventions: 0 }],
  ])("считает счётчики на момент %i", (time, counts) => {
    const script = reworkScript();

    const scene = sceneAt(script, time);

    expect(scene.counts).toEqual(counts);
  });

  it.each([
    [1_000, 1_000],
    [9_200, 2_000],
    [17_000, 3_500],
  ])("в момент %i показывает время записи %i: пока деталь несут, оно стоит", (time, expected) => {
    const script = reworkScript();

    const scene = sceneAt(script, time);

    expect(scene.recordingTime).toBe(expected);
  });

  it.each([
    [-100, { time: 0, finished: false }],
    [1e9, { time: 71_100, finished: true }],
  ])("прижимает момент %d к границам сцены и отмечает конец сборки", (time, expected) => {
    const script = reworkScript();

    const scene = sceneAt(script, time);

    expect({ time: scene.time, finished: scene.finished }).toEqual(expected);
  });
});

describe("sceneAt: мастер и реплики", () => {
  const { post, facing } = LINE_LAYOUT.foreman;
  const specPost = LINE_LAYOUT.stations.planning.foremanPost;
  const towardSpec = headingTo(specPost, LINE_LAYOUT.stations.planning.post);

  // The foreman walks to plan 500–27,500, says the prompt until 28,500, listens to "got it" until
  // 29,500, returns from 30,000: by 57,000 they are at the desk and turn within 150 ms.
  function chatScript(): FactoryScript {
    return buildScript(chatRecording(), LINE_LAYOUT, PLAIN_PACING);
  }

  it("ставит мастера в кабинете у стола лицом к столу до первого разговора", () => {
    const script = chatScript();

    const scene = sceneAt(script, 100);

    expect(scene.foreman).toEqual({
      position: post,
      heading: facing,
      activity: "idle",
      elapsed: 100,
    });
  });

  it("ведёт мастера по пути из кабинета", () => {
    const script = chatScript();

    const scene = sceneAt(script, 4_500);

    // From the door (22, 6) up into the aisle: from 2,500 to 6,500 at one unit per second.
    expect(scene.foreman).toEqual({
      position: { x: 22, y: 4 },
      heading: -Math.PI / 2,
      activity: "walk",
      elapsed: 4_000,
    });
  });

  it.each([
    [28_000, "talk", 500],
    [29_000, "listen", 500],
    [29_700, "idle", 200],
  ] as const)("в момент %i мастер у станка постановки: %s", (time, activity, elapsed) => {
    const script = chatScript();

    const scene = sceneAt(script, time);

    expect(scene.foreman).toEqual({ position: specPost, heading: towardSpec, activity, elapsed });
  });

  it("поворачивает мастера у стола плавно, а не рывком", () => {
    const script = chatScript();

    const scene = sceneAt(script, 57_075);

    // The foreman walks left along the aisle to the desk (π) and turns up (−π/2) along the short
    // arc.
    expect(scene.foreman).toMatchObject({ position: post, activity: "idle" });
    expect(scene.foreman.heading).toBeCloseTo(1.25 * Math.PI);
  });

  it("оставляет мастера у стола лицом к столу после возвращения", () => {
    const recording = withEvents(reworkRecording(), [
      { t: 0, type: "build_start" },
      messageAt(100, "foreman", "planning"),
      { t: 200, type: "build_end", ok: true },
    ]);
    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    // The foreman speaks 27,100–28,100, walks back from 28,600 for 27 s and turns within 150 ms.
    const scene = sceneAt(script, 55_750);

    expect(scene.foreman).toMatchObject({ position: post, heading: facing, activity: "idle" });
  });

  it("стоит в кабинете и в записи без разговоров", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 5_000);

    expect(scene.foreman).toMatchObject({ position: post, heading: facing, activity: "idle" });
  });

  it.each([
    [28_000, 500],
    [28_500, null],
    [27_000, null],
  ])("в момент %i показывает промпт, если он ещё висит: %s", (time, elapsed) => {
    const script = chatScript();

    const scene = sceneAt(script, time);

    expect(scene.prompt?.elapsed ?? null).toBe(elapsed);
  });

  it("отдаёт текущую реплику и сколько она уже висит", () => {
    const script = chatScript();

    const scene = sceneAt(script, 74_650);

    expect(scene.message).toMatchObject({
      cue: { index: 1, speaker: "implementation" },
      elapsed: 500,
    });
  });

  it("не показывает реплику между репликами и после них", () => {
    const script = chatScript();

    const scenes = [sceneAt(script, 100), sceneAt(script, 50_000), sceneAt(script, 110_000)];

    expect(scenes.map((scene) => scene.message)).toEqual([null, null, null]);
  });

  it("не показывает промпт и реплику вместе ни в один момент сцены", () => {
    const script = chatScript();
    const step = 50;

    const together: number[] = [];

    for (let time = 0; time <= script.duration; time += step) {
      const scene = sceneAt(script, time);

      if (scene.prompt !== null && scene.message !== null) together.push(time);
    }

    expect(together).toEqual([]);
  });
});

// Frame sampling step when checking that recording time never goes backwards, ms.
const FRAME_STEP_MS = 20;

describe.each(SPEECH_RECORDINGS)("sceneAt: время записи, запись $name", ({ recording }) => {
  it.each(PLAYBACK_SETUPS)("в начале каждой речи равно времени события: $name", (setup) => {
    const script = buildScript(recording, setup.layout, setup.pacing);

    const mismatches = [
      ...script.prompts.map(({ start, prompt }) => ({ start, t: prompt.t })),
      ...script.interventions.map(({ start, intervention }) => ({ start, t: intervention.t })),
      ...script.messages.map(({ start, message }) => ({ start, t: message.t })),
    ].filter(({ start, t }) => sceneAt(script, start).recordingTime !== t);

    expect(mismatches).toEqual([]);
  });

  it.each(PLAYBACK_SETUPS)("не убывает по всей сцене: $name", (setup) => {
    const script = buildScript(recording, setup.layout, setup.pacing);

    const goingBack: number[] = [];
    let previous = 0;

    for (let time = 0; time <= script.duration; time += FRAME_STEP_MS) {
      const { recordingTime } = sceneAt(script, time);

      if (recordingTime < previous) goingBack.push(time);

      previous = recordingTime;
    }

    expect(goingBack).toEqual([]);
  });
});

describe("sceneAt: время записи при обмене", () => {
  it("доходит до времени первой реплики обмена за время бега", () => {
    const script = buildScript(chatRecording(), LINE_LAYOUT, PLAIN_PACING);
    const first = script.messages.find(({ index }) => index === 2);
    const start = first?.start ?? 0;

    const times = [start - 1_000, start].map((time) => sceneAt(script, time).recordingTime);

    expect(times).toEqual([
      expect.toSatisfy((time: number) => time > 1_500 && time < 3_000),
      3_000,
    ]);
  });
});

describe("sceneAt: вмешательства", () => {
  function interventionScript(): FactoryScript {
    return buildScript(interventionRecording(), LINE_LAYOUT, PLAIN_PACING);
  }

  it("показывает вмешательство и не показывает промпт и реплику", () => {
    const script = interventionScript();
    const cue = script.interventions[0];

    const scene = sceneAt(script, cue?.start ?? 0);

    expect({
      intervention: scene.intervention?.cue.index,
      prompt: scene.prompt,
      message: scene.message,
    }).toEqual({ intervention: 0, prompt: null, message: null });
  });

  it("скрывает вмешательство после пузыря", () => {
    const script = interventionScript();
    const cue = script.interventions[0];

    const scene = sceneAt(script, cue?.end ?? 0);

    expect(scene.intervention).toBeNull();
  });

  it("в начале пузыря время записи равно t", () => {
    const script = interventionScript();
    const cue = script.interventions[0];

    const scene = sceneAt(script, cue?.start ?? 0);

    expect(scene.recordingTime).toBe(cue?.intervention.t);
  });

  it("увеличивает счётчик вмешательств", () => {
    const script = interventionScript();
    const cue = script.interventions[0];

    const counts = [(cue?.start ?? 0) - 1, cue?.end ?? 0].map(
      (time) => sceneAt(script, time).counts.interventions,
    );

    expect(counts).toEqual([0, 1]);
  });

  it("не считает вмешательство промптом", () => {
    const script = interventionScript();
    const cue = script.interventions[0];

    const scene = sceneAt(script, cue?.end ?? 0);

    expect(scene.counts.prompts).toBe(0);
  });
});
