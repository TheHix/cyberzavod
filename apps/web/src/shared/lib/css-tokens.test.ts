import { describe, expect, it } from "vitest";
import { readCssTokens } from "./css-tokens.ts";

describe("readCssTokens", () => {
  it("читает значение токена без пробелов вокруг", () => {
    const tokens = readCssTokens(":root {\n  --ink:  #1d1b33 ;\n  --paper: #fff6e0;\n}");

    const ink = tokens.getPropertyValue("--ink");

    expect(ink).toBe("#1d1b33");
  });

  it("берёт первое объявление токена, а не переопределение ниже", () => {
    const tokens = readCssTokens(
      ":root { --motion-fast: 120ms; }\n@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; } }",
    );

    const motion = tokens.getPropertyValue("--motion-fast");

    expect(motion).toBe("120ms");
  });

  it("отдаёт пустую строку для токена, которого нет", () => {
    const tokens = readCssTokens(":root { --ink: #1d1b33; }");

    const missing = tokens.getPropertyValue("--sun");

    expect(missing).toBe("");
  });
});
