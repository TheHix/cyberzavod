import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProject, projectIdOf } from "./detect.ts";

let root: string;

async function put(file: string, content = ""): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), content);
}

function manifest(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

describe("detectProject", () => {
  beforeEach(async () => {
    root = path.join(await mkdtemp(path.join(tmpdir(), "cyberzavod-detect-")), "shop");
    await mkdir(root);
  });

  afterEach(async () => {
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  it("узнаёт проект на TypeScript с React и pnpm", async () => {
    await put(
      "package.json",
      manifest({
        name: "shop",
        scripts: { test: "vitest", lint: "eslint ." },
        dependencies: { react: "19" },
      }),
    );
    await put("tsconfig.json", "{}");
    await put("pnpm-lock.yaml");
    await put(".git/HEAD");

    const detected = await detectProject(root);

    expect(detected).toEqual({
      name: "shop",
      languages: ["javascript", "typescript"],
      frameworks: ["react"],
      packageManager: "pnpm",
      git: true,
      scripts: ["test", "lint"],
      verification: ["pnpm run lint", "pnpm run test"],
    });
  });

  it("берёт менеджер пакетов из поля packageManager", async () => {
    await put("package.json", manifest({ packageManager: "yarn@4.1.0" }));
    await put("package-lock.json");

    const detected = await detectProject(root);

    expect(detected.packageManager).toBe("yarn");
  });

  it("предлагает только check, если такой скрипт есть", async () => {
    await put("package.json", manifest({ scripts: { check: "x", test: "y" } }));

    const detected = await detectProject(root);

    expect(detected.verification).toEqual(["npm run check"]);
  });

  it("предпочитает цель check в Makefile", async () => {
    await put("go.mod", "module shop");
    await put("Makefile", "VAR := 1\ncheck: test\n\tgo test ./...\ntest:\n");

    const detected = await detectProject(root);

    expect({ scripts: detected.scripts, verification: detected.verification }).toEqual({
      scripts: ["make check", "make test"],
      verification: ["make check"],
    });
  });

  it("без манифестов и Makefile предлагает проверки языка", async () => {
    await put("go.mod", "module shop");

    const detected = await detectProject(root);

    expect({
      name: detected.name,
      languages: detected.languages,
      git: detected.git,
      verification: detected.verification,
    }).toEqual({
      name: "shop",
      languages: ["go"],
      git: false,
      verification: ["go vet ./...", "go test ./..."],
    });
  });

  it("в пустом каталоге ничего не находит", async () => {
    const detected = await detectProject(root);

    expect(detected).toEqual({
      name: "shop",
      languages: [],
      frameworks: [],
      git: false,
      scripts: [],
      verification: [],
    });
  });
});

describe("projectIdOf", () => {
  it.each([
    ["@acme/shop", "acme-shop"],
    ["My Project", "my-project"],
    ["проект", "project"],
    ["lab_2", "lab_2"],
  ])("превращает %s в %s", (name, expected) => {
    const id = projectIdOf(name);

    expect(id).toBe(expected);
  });
});
