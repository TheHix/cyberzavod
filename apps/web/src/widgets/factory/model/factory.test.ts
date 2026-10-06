import { describe, expect, it, vi } from "vitest";
import { FACTORY_LAYOUTS, PORTRAIT_LAYOUT, WIDE_LAYOUT, type Recording } from "@cyberzavod/core";
import { createFactoryModel, type FactoryModel } from "./factory.ts";

// Темп по умолчанию сжимает минуту записи в секунду сцены: постановка работает 0–2 000 мс.
// Первый промпт мастер говорит, дойдя до станка постановки; второй приходит, когда деталь
// уже у станка кода.
function recordingWithPrompt(): Recording {
  return {
    version: 2,
    id: "test",
    project: "test",
    factory: "0.0.0",
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
  return (model.$script.get().prompts[index]?.start ?? 0) + 100;
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

    expect(model.$promptPosition.get()).toEqual(
      model.$script.get().layout.stations.code.foremanPost,
    );
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
  return (model.$script.get().messages[index]?.start ?? 0) + 100;
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

    expect(model.$messagePosition.get()).toEqual(
      model.$script.get().layout.stations.spec.foremanPost,
    );
  });

  it("ставит пузырь над рабочим на его месте, когда он говорит не при передаче", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 1));

    expect(model.$messagePosition.get()).toEqual(model.$script.get().layout.stations.spec.post);
  });

  it("ставит пузырь над рабочим у места встречи, когда он говорит при передаче", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(duringMessage(model, 2));

    const giver = model.$scene.get().workers.find((worker) => worker.station === "code");
    expect(model.$messagePosition.get()).toEqual(giver?.position);
    expect(model.$messagePosition.get()).not.toEqual(model.$script.get().layout.stations.code.post);
  });

  it("не ищет место, когда никто не говорит", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seek(0);

    expect(model.$messagePosition.get()).toBeNull();
  });
});

describe("createFactoryModel: журнал", () => {
  it("не указывает на речь в начале сцены", () => {
    const model = createFactoryModel(recordingWithMessages());

    expect(model.$speech.get()).toBeNull();
  });

  it("ставит сцену на начало пузыря реплики, и $speech указывает на неё", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.seekToSpeech({ kind: "message", index: 1 });

    expect(model.$scene.get().time).toBe(model.$script.get().messages[1]?.start);
    expect(model.$speech.get()).toEqual({ kind: "message", index: 1 });
    expect(model.$message.get()?.index).toBe(1);
  });

  it("ставит сцену на начало пузыря промпта", () => {
    const model = createFactoryModel(recordingWithPrompt());

    model.seekToSpeech({ kind: "prompt", index: 1 });

    expect(model.$scene.get().time).toBe(model.$script.get().prompts[1]?.start);
    expect(model.$prompt.get()?.index).toBe(1);
  });

  it.each([true, false])("не меняет «идёт или пауза» (идёт: %s)", (playing) => {
    const model = createFactoryModel(recordingWithMessages());
    model.start(playing);

    model.seekToSpeech({ kind: "message", index: 2 });

    expect(model.$playing.get()).toBe(playing);
  });

  it("пропускает неизвестную речь", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.seek(500);

    model.seekToSpeech({ kind: "message", index: 9 });

    expect(model.$scene.get().time).toBe(500);
  });

  it("не уведомляет слушателя, пока сцена внутри одной речи", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.seekToSpeech({ kind: "message", index: 0 });
    const listener = vi.fn();
    model.$speech.listen(listener);

    model.seek(duringMessage(model, 0) + 10);
    model.seek(duringMessage(model, 0) + 20);

    expect(listener).not.toHaveBeenCalled();
  });

  it("уведомляет слушателя, когда начинается следующая речь", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.seekToSpeech({ kind: "message", index: 0 });
    const listener = vi.fn();
    model.$speech.listen(listener);

    model.seekToSpeech({ kind: "message", index: 1 });

    expect(listener).toHaveBeenCalledOnce();
    expect(model.$speech.get()).toEqual({ kind: "message", index: 1 });
  });
});

describe("createFactoryModel: план", () => {
  it("начинает на переданном плане и по умолчанию на широком", () => {
    const portrait = createFactoryModel(recordingWithMessages(), PORTRAIT_LAYOUT);
    const byDefault = createFactoryModel(recordingWithMessages());

    expect([portrait.$layout.get(), byDefault.$layout.get()]).toEqual([
      PORTRAIT_LAYOUT,
      WIDE_LAYOUT,
    ]);
  });

  it("отдаёт выбранный план из FACTORY_LAYOUTS", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.setLayout(PORTRAIT_LAYOUT);

    expect(model.$layout.get()).toBe(FACTORY_LAYOUTS[1]);
  });

  it("строит сценарий заново по новому плану", () => {
    const model = createFactoryModel(recordingWithMessages());

    model.setLayout(PORTRAIT_LAYOUT);

    expect(model.$script.get().layout.width).toBe(PORTRAIT_LAYOUT.width);
  });

  it("сохраняет время записи, «идёт или пауза» и скорость", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.start(true);
    model.setSpeed(2);
    model.seek(duringMessage(model, 2) + 700);
    const recordingTime = model.$recordingTime.get();

    model.setLayout(PORTRAIT_LAYOUT);

    const { playing, speed } = model.$playback.get();
    expect(model.$recordingTime.get()).toBeCloseTo(recordingTime, 6);
    expect({ playing, speed }).toEqual({ playing: true, speed: 2 });
  });

  it("сохраняет паузу", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.start(false);
    model.seek(duringMessage(model, 1));

    model.setLayout(PORTRAIT_LAYOUT);

    expect(model.$playing.get()).toBe(false);
  });

  it("не меняет сцену, когда план тот же", () => {
    const model = createFactoryModel(recordingWithMessages(), PORTRAIT_LAYOUT);
    model.seek(duringMessage(model, 1));
    const scene = model.$scene.get();

    model.setLayout(PORTRAIT_LAYOUT);

    expect(model.$scene.get()).toBe(scene);
  });

  it("ставит seekToSpeech на начало речи в новом сценарии", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.setLayout(PORTRAIT_LAYOUT);

    model.seekToSpeech({ kind: "message", index: 2 });

    expect(model.$scene.get().time).toBe(model.$script.get().messages[2]?.start);
  });

  it("отдаёт подписчикам сцены один кадр при смене плана", () => {
    const model = createFactoryModel(recordingWithMessages());
    model.seek(duringMessage(model, 2) + 700);
    const expectedRecordingTime = model.$recordingTime.get();
    const recordingTimes: number[] = [];
    model.$scene.listen((scene) => recordingTimes.push(scene.recordingTime));

    model.setLayout(PORTRAIT_LAYOUT);

    expect(recordingTimes).toEqual([expect.closeTo(expectedRecordingTime, 6)]);
  });

  it("не закрывает уточнения того же промпта, когда сценарий построен заново", () => {
    const model = createFactoryModel(recordingWithPrompt());
    model.seek(duringPrompt(model, 0));
    model.togglePromptDetails();

    model.setLayout(structuredClone(WIDE_LAYOUT));

    expect(model.$promptDetailsOpen.get()).toBe(true);
  });
});
