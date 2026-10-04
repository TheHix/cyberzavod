import { describe, expect, it } from "vitest";
import { formatClock, formatDate, formatDuration, formatTokens } from "./format.ts";

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

  it("переходит на часы с минутами, если сборка дольше часа", () => {
    const result = formatDuration(3_900_000);

    expect(result).toBe("1 ч 05 мин");
  });
});

describe("formatClock", () => {
  it("показывает минуты и секунды в первый час", () => {
    const result = formatClock(125_900);

    expect(result).toBe("2:05");
  });

  it("добавляет часы после первого часа", () => {
    const result = formatClock(3_725_000);

    expect(result).toBe("1:02:05");
  });
});

describe("formatTokens", () => {
  it("разбивает число по разрядам", () => {
    const result = formatTokens(1_234_567);

    // Intl ставит неразрывные пробелы — сравниваем с обычными.
    expect(result.replace(/\s/g, " ")).toBe("1 234 567");
  });
});

describe("formatDate", () => {
  it("пишет день начала словами по UTC", () => {
    const result = formatDate("2026-10-04T23:30:00.000Z");

    expect(result).toBe("4 октября 2026 г.");
  });
});
