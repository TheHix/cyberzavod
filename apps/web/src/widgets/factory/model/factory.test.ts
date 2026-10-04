import { describe, expect, it } from "vitest";
import type { Recording } from "@cyberzavod/core";
import { createFactoryModel } from "./factory.ts";

// Темп по умолчанию сжимает минуту записи в секунду сцены: постановка работает 0–2 000 мс,
// промпт на минуте записи висит над её рабочим с 1 000 до 6 000 мс сцены. Второй промпт
// приходит, когда деталь уже у станка кода.
function recordingWithPrompt(): Recording {
  return {
    version: 1,
    id: "test",
    startedAt: "2026-10-04T00:00:00.000Z",
    title: "Тест",
    events: [
      { t: 0, type: "build_start" },
      { t: 60_000, type: "prompt", goal: "Добавь счётчик", requirements: ["Над цехом"] },
      { t: 120_000, type: "stage_enter", stage: "code" },
      { t: 180_000, type: "prompt", goal: "Покажи токены", requirements: [] },
      { t: 240_000, type: "build_end", ok: true },
    ],
  };
}

describe("createFactoryModel", () => {
  it("не идёт, пока графика не готова", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.advance(1_000);

    expect({ status: model.$status.get(), time: model.$scene.get().time }).toEqual({
      status: "loading",
      time: 0,
    });
  });

  it.each([
    [true, true],
    [false, false],
  ])("с готовой графикой и autoplay=%s сцена идёт: %s", (autoplay, playing) => {
    const model = createFactoryModel(recordingWithPrompt());

    model.start(autoplay);

    expect({ status: model.$status.get(), playing: model.$playing.get() }).toEqual({
      status: "ready",
      playing,
    });
  });

  it("сдвигает сцену на прошедшее время", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.start(true);

    model.advance(500);

    expect(model.$scene.get().time).toBe(500);
  });

  it("показывает промпт, который висит в этот момент", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.seek(1_500);

    expect(model.$prompt.get()?.prompt.goal).toBe("Добавь счётчик");
  });

  it("ставит пузырь промпта над рабочим станка, у которого промпт получен", () => {
    const model = createFactoryModel(recordingWithPrompt());
    const atCode = model.script.prompts[1]?.start ?? 0;

    model.seek(atCode + 100);

    expect(model.$promptPosition.get()).toEqual(model.script.layout.stations.code.post);
  });

  it("ставит сцену на паузу, когда раскрывают уточнения промпта", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.start(true);
    model.seek(1_500);

    model.togglePromptDetails();

    expect({ open: model.$promptDetailsOpen.get(), playing: model.$playing.get() }).toEqual({
      open: true,
      playing: false,
    });
  });

  it("закрывает уточнения, когда промпт сменился", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.seek(1_500);
    model.togglePromptDetails();

    model.seek(7_000);

    expect(model.$promptDetailsOpen.get()).toBe(false);
  });

  it("держит уточнения открытыми, пока висит тот же промпт", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.start(false);
    model.seek(1_500);
    model.togglePromptDetails();
    model.toggle();

    model.advance(100);

    expect(model.$promptDetailsOpen.get()).toBe(true);
  });

  it("меняет скорость проигрывания", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.setSpeed(4);

    expect(model.$playback.get().speed).toBe(4);
  });

  it("не раскрывает уточнения, когда промпта нет", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.togglePromptDetails();

    expect(model.$promptDetailsOpen.get()).toBe(false);
  });
});

// Реплики на тех же минутах: мастер даёт задание коду на минуте записи — над ним у стола,
// а рабочий кода говорит человеку в середине своего визита.
function recordingWithMessages(): Recording {
  return {
    ...recordingWithPrompt(),
    events: [
      { t: 0, type: "build_start" },
      {
        t: 60_000,
        type: "message",
        from: "conductor",
        to: "code",
        line: "Сделай счётчик",
        text: "Сделай счётчик токенов.",
      },
      { t: 120_000, type: "stage_enter", stage: "code" },
      {
        t: 180_000,
        type: "message",
        from: "code",
        to: "human",
        line: "Счётчик готов",
        text: "Счётчик токенов готов.",
      },
      { t: 240_000, type: "build_end", ok: true },
    ],
  };
}

describe("createFactoryModel: реплики", () => {
  it("показывает реплику, которая висит в этот момент", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(1_500);

    expect(model.$message.get()?.message.line).toBe("Сделай счётчик");
  });

  it("не показывает реплику вне её времени", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(100);

    expect(model.$message.get()).toBeNull();
  });

  it("ставит пузырь над мастером, когда говорит он", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(1_500);

    expect(model.$messagePosition.get()).toEqual(model.script.layout.conductor.post);
  });

  it("ставит пузырь над рабочим, когда говорит он", () => {
    const model = createFactoryModel(recordingWithMessages());
    const atCode = model.script.messages[1]?.start ?? 0;

    model.seek(atCode + 100);

    expect(model.$messagePosition.get()).toEqual(model.script.layout.stations.code.post);
  });

  it("не ищет место, когда никто не говорит", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(100);

    expect(model.$messagePosition.get()).toBeNull();
  });
});
