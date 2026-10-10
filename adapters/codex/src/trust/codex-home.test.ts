import path from "node:path";
import { describe, expect, it } from "vitest";
import { codexConfigFile } from "./codex-home.ts";

describe("codexConfigFile", () => {
  it("берёт config.toml из CODEX_HOME, если переменная задана", () => {
    const file = codexConfigFile({ env: { CODEX_HOME: "/data/codex" }, homeDirectory: "/home/me" });

    expect(file).toBe(path.join("/data/codex", "config.toml"));
  });

  it("берёт ~/.codex/config.toml, если переменной нет", () => {
    const file = codexConfigFile({ env: {}, homeDirectory: "/home/me" });

    expect(file).toBe(path.join("/home/me", ".codex", "config.toml"));
  });

  it("считает пустую CODEX_HOME незаданной", () => {
    const file = codexConfigFile({ env: { CODEX_HOME: "" }, homeDirectory: "/home/me" });

    expect(file).toBe(path.join("/home/me", ".codex", "config.toml"));
  });
});
