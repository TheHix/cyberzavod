import { describe, expect, it } from "vitest";
import {
  advance,
  isAtEnd,
  seek,
  speedFrom,
  startPlayback,
  togglePlaying,
  withDuration,
} from "./playback.ts";

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

describe("isAtEnd", () => {
  it.each([
    [10_000, true],
    [9_999, false],
    [0, false],
  ])("в момент %i мс сцены длиной 10 с отвечает %s", (position, expected) => {
    const playback = seek(startPlayback(10_000, false), position);

    const atEnd = isAtEnd(playback);

    expect(atEnd).toBe(expected);
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

describe("speedFrom", () => {
  it.each([
    ["2", 2],
    ["4", 4],
    ["3", undefined],
    ["", undefined],
  ])("узнаёт скорость по записи «%s»: %s", (value, expected) => {
    const speed = speedFrom(value);

    expect(speed).toBe(expected);
  });
});

describe("withDuration", () => {
  it("меняет длительность и ставит позицию", () => {
    const playback = startPlayback(10_000, false);

    const next = withDuration(playback, 20_000, 12_000);

    expect({ duration: next.duration, position: next.position }).toEqual({
      duration: 20_000,
      position: 12_000,
    });
  });

  it.each([
    [-5, 0],
    [30_000, 8_000],
  ])("прижимает позицию %i к границам новой сцены: %i", (position, expected) => {
    const playback = startPlayback(10_000, false);

    const next = withDuration(playback, 8_000, position);

    expect(next.position).toBe(expected);
  });

  it("сохраняет, идёт ли проигрывание, и скорость", () => {
    const playback = { ...startPlayback(10_000, true), speed: 4 as const };

    const next = withDuration(playback, 8_000, 1_000);

    expect({ playing: next.playing, speed: next.speed }).toEqual({ playing: true, speed: 4 });
  });
});
