import { describe, expect, it } from "vitest";
import type { Recording } from "@cyberzavod/core";
import { createFactoryModel, type FactoryModel } from "./factory.ts";

// Темп по умолчанию сжимает минуту записи в секунду сцены: постановка работает 0–2 000 мс.
// Первый промпт мастер говорит, дойдя до станка постановки; второй приходит, когда деталь
// уже у станка кода.
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

// Момент сцены, когда висит промпт с номером `index`: чуть позже его начала.
function duringPrompt(model: FactoryModel, index: number): number {
  return (model.script.prompts[index]?.start ?? 0) + 100;
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

    model.seek(duringPrompt(model, 0));

    expect(model.$prompt.get()?.prompt.goal).toBe("Добавь счётчик");
  });

  it("ставит пузырь промпта над мастером, который говорит его у станка", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.seek(duringPrompt(model, 1));

    expect(model.$promptPosition.get()).toEqual(model.script.layout.stations.code.foremanPost);
  });

  it("не ищет место промпта, когда его никто не говорит", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.seek(0);

    expect(model.$promptPosition.get()).toBeNull();
  });

  it("ставит сцену на паузу, когда раскрывают уточнения промпта", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.start(true);
    model.seek(duringPrompt(model, 0));

    model.togglePromptDetails();

    expect({ open: model.$promptDetailsOpen.get(), playing: model.$playing.get() }).toEqual({
      open: true,
      playing: false,
    });
  });

  it("закрывает уточнения, когда промпт сменился", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.seek(duringPrompt(model, 0));
    model.togglePromptDetails();

    model.seek(duringPrompt(model, 1));

    expect(model.$promptDetailsOpen.get()).toBe(false);
  });

  it("держит уточнения открытыми, пока висит тот же промпт", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.start(false);
    model.seek(duringPrompt(model, 0));
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

// Реплики на тех же минутах: мастер даёт задание постановке, постановка говорит на месте
// (адресат не следующий по передаче), а рабочий кода обменивается репликой с проверками
// у места передачи.
function recordingWithMessages(): Recording {
  return {
    ...recordingWithPrompt(),
    events: [
      { t: 0, type: "build_start" },
      {
        t: 60_000,
        type: "message",
        from: "foreman",
        to: "spec",
        line: "Сделай счётчик",
        text: "Сделай счётчик токенов.",
      },
      {
        t: 90_000,
        type: "message",
        from: "spec",
        to: "test",
        line: "Критерии на тебе",
        text: "Критерии проверок на тебе.",
      },
      { t: 120_000, type: "stage_enter", stage: "code" },
      {
        t: 180_000,
        type: "message",
        from: "code",
        to: "test",
        line: "Держи, счётчик готов",
        text: "Держи, счётчик токенов готов.",
      },
      { t: 240_000, type: "stage_enter", stage: "test" },
      { t: 300_000, type: "build_end", ok: true },
    ],
  };
}

// Момент сцены, когда висит реплика с номером `index`: чуть позже её начала.
function duringMessage(model: FactoryModel, index: number): number {
  return (model.script.messages[index]?.start ?? 0) + 100;
}

describe("createFactoryModel: реплики", () => {
  it("показывает реплику, которая висит в этот момент", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 0));

    expect(model.$message.get()?.message.line).toBe("Сделай счётчик");
  });

  it("не показывает реплику вне её времени", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(0);

    expect(model.$message.get()).toBeNull();
  });

  it("ставит пузырь над мастером, когда говорит он", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 0));

    expect(model.$messagePosition.get()).toEqual(model.script.layout.stations.spec.foremanPost);
  });

  it("ставит пузырь над рабочим на его месте, когда он говорит не при передаче", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 1));

    expect(model.$messagePosition.get()).toEqual(model.script.layout.stations.spec.post);
  });

  it("ставит пузырь над рабочим у места встречи, когда он говорит при передаче", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 2));

    const giver = model.$scene.get().workers.find((worker) => worker.station === "code");
    expect(model.$messagePosition.get()).toEqual(giver?.position);
    expect(model.$messagePosition.get()).not.toEqual(model.script.layout.stations.code.post);
  });

  it("не ищет место, когда никто не говорит", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(0);

    expect(model.$messagePosition.get()).toBeNull();
  });
});
