import { describe, expect, it } from "vitest";
import {
  GENERATED_MARK,
  HASH_GENERATED_COMMENT,
  isGenerated,
  LEGACY_GENERATED_MARK,
  MARKDOWN_GENERATED_COMMENT,
} from "./marks.ts";

describe("isGenerated", () => {
  it("узнаёт файл с отметкой в обоих видах комментария", () => {
    expect(isGenerated(`${MARKDOWN_GENERATED_COMMENT}\ntext`)).toBe(true);
    expect(isGenerated(`${HASH_GENERATED_COMMENT}\nkey = 1`)).toBe(true);
  });

  it("узнаёт прежнюю русскую отметку", () => {
    expect(isGenerated(`<!-- ${LEGACY_GENERATED_MARK} -->`)).toBe(true);
  });

  it("не принимает файл человека за сгенерированный", () => {
    expect(isGenerated("# my rules\n")).toBe(false);
    expect(GENERATED_MARK).toContain("cyberzavod sync");
  });
});
