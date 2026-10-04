import { describe, expect, it } from "vitest";
import { formatDuration, formatTokens } from "./format.ts";

describe("formatDuration", () => {
  it("показывает только секунды, если меньше минуты", () => {
    const result = formatDuration(42_400);

    expect(result).toBe("42 с");
  });

  it("дополняет секунды нулём, если есть минуты", () => {
    const result = formatDuration(125_000);

    expect(result).toBe("2 мин 05 с");
  });

  it("округляет 59,6 с до целой минуты, а не до «60 с»", () => {
    const result = formatDuration(59_600);

    expect(result).toBe("1 мин 00 с");
  });
});

describe("formatTokens", () => {
  it("разбивает число по разрядам", () => {
    const result = formatTokens(1_234_567);

    // Intl ставит неразрывные пробелы — сравниваем с обычными.
    expect(result.replace(/\s/g, " ")).toBe("1 234 567");
  });
});
