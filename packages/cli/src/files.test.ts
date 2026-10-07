import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readOptionalText } from "./files.ts";

let directory: string;

describe("readOptionalText", () => {
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "cyberzavod-files-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("читает существующий файл", async () => {
    const file = path.join(directory, "note.txt");

    await writeFile(file, "текст");

    const text = await readOptionalText(file);

    expect(text).toBe("текст");
  });

  it("для отсутствующего файла возвращает undefined", async () => {
    const file = path.join(directory, "missing.txt");

    const text = await readOptionalText(file);

    expect(text).toBeUndefined();
  });
});
