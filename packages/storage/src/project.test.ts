import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { temporaryDirectory, validConfig } from "./fixtures.ts";
import {
  findProjectRoot,
  PROJECT_CONFIG_FILE,
  ProjectFileError,
  readProjectConfig,
  writeProjectConfig,
} from "./project.ts";

describe("readProjectConfig", () => {
  it("читает то, что записал writeProjectConfig", async () => {
    const root = await temporaryDirectory();

    await writeProjectConfig(root, validConfig());

    const config = await readProjectConfig(root);

    expect(config).toEqual(validConfig());
  });

  it("без маркера возвращает undefined", async () => {
    const root = await temporaryDirectory();

    const config = await readProjectConfig(root);

    expect(config).toBeUndefined();
  });

  it("называет файл, если конфиг битый", async () => {
    const root = await temporaryDirectory();

    await writeProjectConfig(root, validConfig());
    await writeFile(path.join(root, PROJECT_CONFIG_FILE), '{"projectId": "../x"}');

    const act = () => readProjectConfig(root);

    await expect(act()).rejects.toThrow(ProjectFileError);
  });
});

describe("findProjectRoot", () => {
  it("находит корень проекта из вложенного каталога", async () => {
    const root = await temporaryDirectory();

    await writeProjectConfig(root, validConfig());
    const nested = path.join(root, "apps", "web");

    await mkdir(nested, { recursive: true });

    const found = await findProjectRoot(nested);

    expect(found).toBe(root);
  });

  it("без маркера на всём пути возвращает undefined", async () => {
    const directory = await temporaryDirectory();

    const found = await findProjectRoot(directory);

    expect(found).toBeUndefined();
  });
});
