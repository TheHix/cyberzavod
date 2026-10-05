import { afterEach, describe, expect, it, vi } from "vitest";
import type { Recording } from "@cyberzavod/core";
import { createFactoryModel } from "../model/factory.ts";
import { startFrameClock } from "./frame-clock.ts";

function recording(): Recording {
  return {
    version: 2,
    id: "test",
    project: "test",
    factory: "0.0.0",
    startedAt: "2026-10-04T00:00:00.000Z",
    title: "Тест",
    events: [
      { t: 0, type: "build_start" },
      { t: 600_000, type: "build_end", ok: true },
    ],
  };
}

// Браузер без браузера: кадры, «экран», вкладка и часы performance переключаются тестом.
function fakeBrowser() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let reportIntersection: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  const visibilityListeners: (() => void)[] = [];
  const document = {
    visibilityState: "visible",
    addEventListener: (_type: string, listener: () => void) => visibilityListeners.push(listener),
    removeEventListener: vi.fn(),
  };
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("document", document);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(nextId, callback);
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: typeof reportIntersection) {
        reportIntersection = callback;
      }
    },
  );

  const switchTab = (state: "visible" | "hidden") => {
    document.visibilityState = state;
    for (const listener of visibilityListeners) listener();
  };
  return {
    pendingFrames: () => frames.size,
    runFrame(time: number) {
      const [first] = frames;
      if (first === undefined) throw new Error("кадр не запрошен");
      frames.delete(first[0]);
      first[1](time);
    },
    setNow: (time: number) => now.mockReturnValue(time),
    setOnScreen: (onScreen: boolean) => reportIntersection?.([{ isIntersecting: onScreen }]),
    hideTab: () => switchTab("hidden"),
    showTab: () => switchTab("visible"),
  };
}

const container = {} as HTMLElement;

function playingModel() {
  const model = createFactoryModel(recording());
  model.start(true);
  return model;
}

describe("startFrameClock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("двигает сцену на время между кадрами", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    startFrameClock(model, container);

    browser.runFrame(16);

    expect(model.$scene.get().time).toBe(16);
  });

  it("ограничивает шаг после долгого разрыва между кадрами — сцена не прыгает", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    startFrameClock(model, container);
    browser.runFrame(16);

    browser.runFrame(10_016);

    expect(model.$scene.get().time).toBe(116);
  });

  it("не просит кадры на паузе и начинает при пуске", () => {
    const browser = fakeBrowser();
    const model = createFactoryModel(recording());
    model.start(false);
    startFrameClock(model, container);
    const beforeStart = browser.pendingFrames();

    model.toggle();

    expect([beforeStart, browser.pendingFrames()]).toEqual([0, 1]);
  });

  it("оставляет один цикл кадров, если между кадрами поставили паузу и снова пустили", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    startFrameClock(model, container);
    model.toggle();

    model.toggle();

    expect(browser.pendingFrames()).toBe(1);
  });

  it("стоит, пока цех не на экране, и по возвращении не догоняет пропущенное время", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    startFrameClock(model, container);
    browser.setOnScreen(false);
    browser.runFrame(16);
    browser.setNow(60_000);
    browser.setOnScreen(true);

    browser.runFrame(60_016);

    expect({ time: model.$scene.get().time, pending: browser.pendingFrames() }).toEqual({
      time: 32,
      pending: 1,
    });
  });

  it("стоит в фоновой вкладке и продолжает, когда на неё вернулись", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    startFrameClock(model, container);
    browser.hideTab();
    browser.runFrame(16);
    const inBackground = browser.pendingFrames();

    browser.showTab();

    expect([inBackground, browser.pendingFrames()]).toEqual([0, 1]);
  });

  it("отменяет запрошенный кадр при остановке", () => {
    const browser = fakeBrowser();
    const model = playingModel();
    const stop = startFrameClock(model, container);

    stop();

    expect(browser.pendingFrames()).toBe(0);
  });
});
