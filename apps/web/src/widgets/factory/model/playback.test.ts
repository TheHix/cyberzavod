import { describe, expect, it } from "vitest";
import { advance, nextSpeed, seek, startPlayback, togglePlaying } from "./playback.ts";

describe("advance", () => {
  it("сдвигает момент на прошедшее время с учётом скорости", () => {
    const playback = { ...startPlayback(10_000, true), speed: 2 as const };

    const next = advance(playback, 1_000);

    expect(next.position).toBe(2_000);
  });

  it("останавливается в конце сцены", () => {
    const playback = seek(startPlayback(10_000, true), 9_500);

    const next = advance(playback, 1_000);

    expect({ position: next.position, playing: next.playing }).toEqual({
      position: 10_000,
      playing: false,
    });
  });

  it("не двигает момент на паузе", () => {
    const playback = startPlayback(10_000, false);

    const next = advance(playback, 1_000);

    expect(next.position).toBe(0);
  });
});

describe("seek", () => {
  it.each([
    [-5, 0],
    [20_000, 10_000],
  ])("прижимает момент %i к границам сцены: %i", (position, expected) => {
    const playback = startPlayback(10_000, false);

    const next = seek(playback, position);

    expect(next.position).toBe(expected);
  });
});

describe("togglePlaying", () => {
  it("запускает досмотренную сцену с начала", () => {
    const playback = seek(startPlayback(10_000, false), 10_000);

    const next = togglePlaying(playback);

    expect({ position: next.position, playing: next.playing }).toEqual({
      position: 0,
      playing: true,
    });
  });

  it("ставит на паузу, не трогая момент", () => {
    const playback = seek(startPlayback(10_000, true), 4_000);

    const next = togglePlaying(playback);

    expect({ position: next.position, playing: next.playing }).toEqual({
      position: 4_000,
      playing: false,
    });
  });
});

describe("nextSpeed", () => {
  it("переключает на следующую скорость", () => {
    const playback = startPlayback(10_000, false);

    const next = nextSpeed(playback);

    expect(next.speed).toBe(2);
  });

  it("после самой быстрой возвращается к обычной", () => {
    const playback = { ...startPlayback(10_000, false), speed: 4 as const };

    const next = nextSpeed(playback);

    expect(next.speed).toBe(1);
  });
});
