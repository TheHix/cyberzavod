import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { machine, messages } from "./fixtures.ts";
import { MINIMUM_NODE_MAJOR, nodeCheck } from "./node.ts";

describe("nodeCheck", () => {
  it("принимает Node нужной версии", async () => {
    const result = await nodeCheck.run(machine({ nodeVersion: "22.1.0" }), messages);

    expect(result).toEqual({ status: "passed", summary: "Node.js 22.1.0" });
  });

  it("отклоняет Node старше минимальной мажорной версии и просит поставить новый", async () => {
    const result = await nodeCheck.run(machine({ nodeVersion: "20.11.1" }), messages);

    expect(result).toEqual({
      status: "failed",
      problem: "Node.js 20.11.1 is too old: 22 or newer is needed",
      fix: "install Node.js 22 or newer",
    });
  });

  it("держит минимальную версию в согласии с engines пакета", async () => {
    const manifest = await readFile(new URL("../../package.json", import.meta.url), "utf8");
    const { engines } = JSON.parse(manifest) as { engines: { node: string } };

    expect(engines.node).toBe(`>=${MINIMUM_NODE_MAJOR}`);
  });
});
