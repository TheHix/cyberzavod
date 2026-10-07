import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimHumanCallMarker,
  findProjectId,
  humanCallMarkerPath,
  PROJECT_CONFIG_FILE,
} from "./paths.ts";

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

  it("поднимается выше, когда на пути лежит файл, а не каталог", async () => {
    await writeConfig(root, JSON.stringify({ id: "lab", factory: "0.1.0" }));
    await writeFile(path.join(root, "file.txt"), "");

    const id = await findProjectId(path.join(root, "file.txt", "inside"));

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

describe("humanCallMarkerPath", () => {
  const HOOKS_LIB = path.resolve(import.meta.dirname, "../../../../.claude/hooks/lib.sh");

  // Имя отметки считает human_call_marker из lib.sh — та же функция, что вызывает stop-gate.sh.
  function hookMarkerOf(sessionId: string, tmpDir: string): string {
    return execFileSync(
      "bash",
      ["-c", `. "$1" && human_call_marker "$2"`, "bash", HOOKS_LIB, sessionId],
      { env: { ...process.env, TMPDIR: tmpDir }, encoding: "utf8" },
    ).trim();
  }

  it.each(["test-session", "4365c610-eb0b-5804-9f56-76a794755af5", "a_b-1"])(
    "совпадает с отметкой хука остановки: %s",
    (sessionId) => {
      const tmpDir = "/var/tmp/cz";

      const markerPath = humanCallMarkerPath(sessionId, tmpDir);

      expect(markerPath).toBe(hookMarkerOf(sessionId, tmpDir));
    },
  );

  it("убирает из id сессии всё, кроме безопасных символов, как хук остановки", () => {
    const tmpDir = "/var/tmp/cz";

    const markerPath = humanCallMarkerPath("../s 1/", tmpDir);

    expect(markerPath).toBe(hookMarkerOf("../s 1/", tmpDir));
  });

  it("называет пустой id сессии unknown, как хук остановки", () => {
    const tmpDir = "/var/tmp/cz";

    const markerPath = humanCallMarkerPath("", tmpDir);

    expect(markerPath).toBe("/var/tmp/cz/factory-human-call-unknown");
  });
});

describe("claimHumanCallMarker", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-marker-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("удаляет отметку и сообщает, что она была", async () => {
    const markerPath = humanCallMarkerPath("s1", root);
    await writeFile(markerPath, "4");

    const claimed = await claimHumanCallMarker("s1", root);

    expect({
      claimed,
      left: await access(markerPath).then(
        () => true,
        () => false,
      ),
    }).toEqual({
      claimed: true,
      left: false,
    });
  });

  it("без отметки возвращает false и молчит", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const claimed = await claimHumanCallMarker("s1", root);

    expect({ claimed, warnings: warn.mock.calls.length }).toEqual({ claimed: false, warnings: 0 });
  });

  it("при другой ошибке предупреждает и возвращает false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(humanCallMarkerPath("s1", root));

    const claimed = await claimHumanCallMarker("s1", root);

    expect({ claimed, warnings: warn.mock.calls.length }).toEqual({ claimed: false, warnings: 1 });
  });
});
