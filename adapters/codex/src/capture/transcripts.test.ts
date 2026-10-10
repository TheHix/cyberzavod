import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRollout } from "./transcripts.ts";

let directory: string;

describe("readRollout", () => {
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "cyberzavod-rollout-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("читает обычный rollout", async () => {
    const file = path.join(directory, "rollout.jsonl");

    await writeFile(file, "строка");

    const reading = await readRollout(file);

    expect(reading).toEqual({ status: "read", text: "строка" });
  });

  it("называет сжатым rollout, от которого остался только файл .zst", async () => {
    const file = path.join(directory, "rollout.jsonl");

    await writeFile(`${file}.zst`, "");

    const reading = await readRollout(file);

    expect(reading).toEqual({ status: "compressed" });
  });

  it("называет пропавшим rollout, которого нет ни в каком виде", async () => {
    const reading = await readRollout(path.join(directory, "gone.jsonl"));

    expect(reading.status).toBe("missing");
  });
});
