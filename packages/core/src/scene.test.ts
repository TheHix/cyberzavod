import { describe, expect, it } from "vitest";
import { sceneAt } from "./scene.ts";
import { headingTo } from "./layout.ts";
import type { Recording } from "./recording.ts";
import {
  chatRecording,
  LINE_LAYOUT,
  messageAt,
  PLAIN_PACING,
  reworkRecording,
} from "./script.fixtures.ts";
import { buildScript, type FactoryScript } from "./script.ts";

// Моменты сцены для reworkRecording — см. тесты buildScript: постановка работает 0–2 000,
// поднимает деталь до 2 200, несёт её коду (по проходу — 4 200–14 200), отдаёт 15 200–15 300;
// код поворачивается к ней с 15 050, кладёт деталь до 15 500 и работает 15 500–18 500.
function reworkScript(): FactoryScript {
  return buildScript(reworkRecording(), LINE_LAYOUT, PLAIN_PACING);
}

describe("sceneAt", () => {
  it("ведёт бегущего рабочего с деталью в руках", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 9_200);

    expect({ worker: scene.workers[0], part: scene.part }).toEqual({
      worker: {
        station: "spec",
        position: { x: 5, y: 2 },
        heading: 0,
        activity: "walk",
        elapsed: 7_000,
        carrying: true,
      },
      part: { position: { x: 5.45, y: 2 }, holder: "spec", carried: true, status: "ok" },
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

    // На полпути от «к станку» (−π/2) к «к проходу» (π/2).
    expect(scene.workers[1]?.heading).toBeCloseTo(0);
  });

  it("поворачивает по кратчайшей дуге, даже через ±π", () => {
    const script = reworkScript();

    // Рабочий проверок бежит по проходу влево (π) и с 57 000 поворачивает вверх (−π/2):
    // на полпути поворота это 5π/4, а не π/4, как вышло бы в обход через ноль.
    const scene = sceneAt(script, 57_075);

    expect(scene.workers[2]?.heading).toBeCloseTo(1.25 * Math.PI);
  });

  it("передаёт деталь из рук в руки, а не перескоком", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 15_250);

    // Посередине между руками отдающего (y = 0,55) и получателя (y = 0,45).
    expect([scene.part.position.x, scene.part.position.y, scene.part.holder]).toEqual([
      10,
      expect.closeTo(0.5),
      "code",
    ]);
  });

  it("держит свободного рабочего у его станка лицом к станку", () => {
    const script = reworkScript();

    const scene = sceneAt(script, 5_000);

    expect(scene.workers[2]).toEqual({
      station: "test",
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
      part: { position: { x: 10, y: -1 }, holder: "code", carried: false, status: "ok" },
    });
  });

  it.each([
    [500, { tokens: 0, prompts: 0, reworks: 0 }],
    [40_000, { tokens: 0, prompts: 0, reworks: 1 }],
    [71_000, { tokens: 1_200, prompts: 0, reworks: 1 }],
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
  const specPost = LINE_LAYOUT.stations.spec.foremanPost;
  const towardSpec = headingTo(specPost, LINE_LAYOUT.stations.spec.post);

  // Мастер идёт к постановке 500–27 500, говорит промпт до 28 500, слушает «принял» до 29 500,
  // с 30 000 возвращается: к 57 000 он у стола и поворачивается за 150 мс.
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

    // От двери (22, 6) вверх в проход: с 2 500 до 6 500 по единице в секунду.
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

    // К столу мастер идёт по проходу влево (π) и поворачивается вверх (−π/2) по короткой дуге.
    expect(scene.foreman).toMatchObject({ position: post, activity: "idle" });
    expect(scene.foreman.heading).toBeCloseTo(1.25 * Math.PI);
  });

  it("оставляет мастера у стола лицом к столу после возвращения", () => {
    const recording = {
      ...reworkRecording(),
      events: [
        { t: 0, type: "build_start" },
        messageAt(100, "foreman", "spec"),
        { t: 200, type: "build_end", ok: true },
      ],
    } satisfies Recording;
    const script = buildScript(recording, LINE_LAYOUT, PLAIN_PACING);

    // Мастер говорит 27 100–28 100, с 28 600 идёт назад 27 с и поворачивается за 150 мс.
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

    expect(scene.message).toMatchObject({ cue: { index: 1, speaker: "code" }, elapsed: 500 });
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
