import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findProjectId, PROJECT_CONFIG_FILE } from "./paths.ts";

let root: string;

async function writeConfig(directory: string, content: string): Promise<void> {
  await mkdir(path.join(directory, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(directory, PROJECT_CONFIG_FILE), content);
}

describe("findProjectId", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-paths-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("находит id проекта в самом каталоге", async () => {
    await writeConfig(root, JSON.stringify({ id: "lab", factory: "0.1.0" }));

    const id = await findProjectId(root);

    expect(id).toBe("lab");
  });

  it("поднимается из подкаталога до конфига", async () => {
    await writeConfig(root, JSON.stringify({ id: "lab", factory: "0.1.0" }));
    const nested = path.join(root, "src", "state");
    await mkdir(nested, { recursive: true });

    const id = await findProjectId(nested);

    expect(id).toBe("lab");
  });

  it("берёт ближайший конфиг", async () => {
    await writeConfig(root, JSON.stringify({ id: "outer", factory: "0.1.0" }));
    const inner = path.join(root, "inner");
    await writeConfig(inner, JSON.stringify({ id: "inner", factory: "0.1.0" }));

    const id = await findProjectId(inner);

    expect(id).toBe("inner");
  });

  it("находит конфиг, когда каталога уже нет", async () => {
    await writeConfig(root, JSON.stringify({ id: "lab", factory: "0.1.0" }));

    const id = await findProjectId(path.join(root, "removed", "deeper"));

    expect(id).toBe("lab");
  });

  it("возвращает undefined, когда конфига нет на всём пути", async () => {
    const id = await findProjectId(root);

    expect(id).toBeUndefined();
  });

  it("предупреждает о битом конфиге и возвращает undefined", async () => {
    await writeConfig(root, "{ не json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const id = await findProjectId(root);

    expect([id, warn.mock.calls.length]).toEqual([undefined, 1]);
  });
});
