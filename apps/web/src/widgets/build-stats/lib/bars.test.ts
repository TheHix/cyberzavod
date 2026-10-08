import { describe, expect, it } from "vitest";
import { barOf } from "./bars.ts";

describe("barOf", () => {
  it("пишет число строки по правилам языка страницы", () => {
    const bar = barOf("Review", 12_345, "en");

    expect(bar).toEqual({ label: "Review", value: 12_345, valueText: "12,345" });
  });
});
