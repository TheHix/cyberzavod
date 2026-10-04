import { describe, expect, it } from "vitest";
import { cx } from "./cx.ts";

describe("cx", () => {
  it("склеивает включённые классы и пропускает выключенные", () => {
    const classes = cx("button", false, "primary", undefined, null, "");

    expect(classes).toBe("button primary");
  });
});
