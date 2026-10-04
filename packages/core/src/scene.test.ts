import { describe, expect, it } from "vitest";
import { sceneAt } from "./scene.ts";
import { LINE_LAYOUT, PLAIN_PACING, reworkRecording } from "./script.fixtures.ts";
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
    [1_500, 500],
    [2_500, null],
  ])("в момент %i показывает промпт, если он ещё висит: %s", (time, elapsed) => {
    const script = reworkScript();

    const scene = sceneAt(script, time);

    expect(scene.prompt?.elapsed ?? null).toBe(elapsed);
  });

  it.each([
    [500, { tokens: 0, prompts: 0, reworks: 0 }],
    [40_000, { tokens: 0, prompts: 1, reworks: 1 }],
    [71_000, { tokens: 1_200, prompts: 1, reworks: 1 }],
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
