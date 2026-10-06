import { describe, expect, it } from "vitest";
import { alignMarks } from "./marks.ts";
import type { Mark } from "./script.ts";

function markOf(at: number, recordingTime: number, tokens = 0): Mark {
  return { at, recordingTime, tokens, prompts: 0, reworks: 0, interventions: 0 };
}

describe("alignMarks", () => {
  it("не трогает отметки с неубывающим временем сцены", () => {
    const marks = [markOf(0, 0), markOf(10, 5), markOf(10, 5), markOf(20, 8)];

    const aligned = alignMarks(marks);

    expect(aligned).toEqual(marks);
  });

  it("ставит обогнанную отметку между опорными по доле времени записи", () => {
    const marks = [markOf(0, 0), markOf(100, 100), markOf(60, 150), markOf(200, 200)];

    const aligned = alignMarks(marks);

    expect(aligned.map((mark) => mark.at)).toEqual([0, 100, 150, 200]);
  });

  it("ставит отметку с тем же временем записи на момент предыдущей опорной", () => {
    const marks = [markOf(0, 0), markOf(100, 100), markOf(60, 100), markOf(200, 200)];

    const aligned = alignMarks(marks);

    expect(aligned.map((mark) => mark.at)).toEqual([0, 100, 100, 200]);
  });

  it("без опорной справа ставит отметку на момент последней опорной", () => {
    const marks = [markOf(0, 0), markOf(100, 100), markOf(60, 150), markOf(50, 170)];

    const aligned = alignMarks(marks);

    expect(aligned.map((mark) => mark.at)).toEqual([0, 100, 100, 100]);
  });

  it("не меняет порядок, время записи и счётчики", () => {
    const marks = [markOf(0, 0, 1), markOf(100, 100, 2), markOf(60, 150, 3), markOf(200, 200, 4)];

    const aligned = alignMarks(marks);

    expect(aligned.map(({ recordingTime, tokens }) => [recordingTime, tokens])).toEqual([
      [0, 1],
      [100, 2],
      [150, 3],
      [200, 4],
    ]);
  });

  it("возвращает пустой список для пустого", () => {
    const aligned = alignMarks([]);

    expect(aligned).toEqual([]);
  });
});
