import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, TOOL_FILE } from "@cyberzavod/storage";
import { runCli } from "./cli.ts";
import type { Environment } from "./messages/language.ts";

// Из исходников CLI собранного себя не знает; тесту хватает любого текста на его месте.
const BUILT_TOOL = "// собранный cyberzavod\n";

vi.mock("./installation/assets.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("./installation/assets.ts")>();

  return {
    readAssets: async () => ({ ...(await original.readAssets()), tool: BUILT_TOOL }),
  };
});

const SESSION_ID = "cli-test-hook-language";
const EN_TITLE = "Cyberzavod — an AI-agent development process, local-first.";
const RU_TITLE = "Cyberzavod — процесс разработки с ИИ-агентами, локально.";

// Окружение без языковых переменных: язык сообщений — английский.
const NO_LOCALE: Environment = {};

let workspace: string;
let root: string;

async function initialized(): Promise<void> {
  await runCli(["init", "--yes"], root, NO_LOCALE);
}

function stdinWith(payload: object): typeof process.stdin {
  return Readable.from([Buffer.from(JSON.stringify(payload))]) as typeof process.stdin;
}

function printedLog(): string {
  return vi.mocked(console.log).mock.calls.join("\n");
}

function printedError(): string {
  return vi.mocked(console.error).mock.calls.join("\n");
}

async function journalFiles(collection: string): Promise<string[]> {
  return readdir(path.join(root, ".cyberzavod/journal", collection));
}

describe("runCli", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-cli-"));
    root = path.join(workspace, "shop");
    await mkdir(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "x" } }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  it("без команды печатает справку и выходит с успехом", async () => {
    const code = await runCli([], root, NO_LOCALE);

    expect(code).toBe(0);
  });

  it("на неизвестную команду печатает справку и выходит с ошибкой", async () => {
    const code = await runCli(["deploy"], root, NO_LOCALE);

    expect(code).toBe(1);
  });

  it.each(["constructor", "__proto__", "toString"])(
    "имя %s из прототипа объекта — неизвестная команда: справка и код 1",
    async (name) => {
      const code = await runCli([name], root, NO_LOCALE);

      expect({ code, help: printedLog().startsWith(EN_TITLE) }).toEqual({ code: 1, help: true });
    },
  );

  it("справка по умолчанию английская и называет флаг языка", async () => {
    await runCli(["--help"], root, NO_LOCALE);

    const help = printedLog();

    expect(help).toContain("Cyberzavod — an AI-agent development process");
    expect(help).toContain("--lang en|ru");
  });

  it("справка по локали системы — русская", async () => {
    await runCli(["--help"], root, { LANG: "ru_RU.UTF-8" });

    const help = printedLog();

    expect(help).toContain("процесс разработки с ИИ-агентами");
    expect(help).toContain("--lang en|ru");
  });

  it.each([
    ["--lang перекрывает локаль", ["--help", "--lang", "en"], { LANG: "ru_RU.UTF-8" }, EN_TITLE],
    ["--lang=язык перед командой", ["--lang=en", "--help"], { CYBERZAVOD_LANG: "ru" }, EN_TITLE],
    [
      "CYBERZAVOD_LANG перекрывает локаль",
      ["--help"],
      { LANG: "en_US.UTF-8", CYBERZAVOD_LANG: "ru" },
      RU_TITLE,
    ],
    ["LC_ALL важнее LANG", ["--help"], { LC_ALL: "ru_RU.UTF-8", LANG: "en_US.UTF-8" }, RU_TITLE],
  ] as const)("%s", async (_name, argv, env, title) => {
    await runCli([...argv], root, env);

    const [firstLine] = printedLog().split("\n");

    expect(firstLine).toBe(title);
  });

  it("--lang с неподдерживаемым языком — ошибка на языке без флага", async () => {
    const code = await runCli(["--help", "--lang", "de"], root, { LANG: "ru_RU.UTF-8" });

    expect({ code, error: printedError() }).toEqual({
      code: 1,
      error: "cyberzavod: язык «de» не поддерживается: доступны en, ru",
    });
  });

  it("--lang без значения — ошибка", async () => {
    const code = await runCli(["status", "--lang"], root, NO_LOCALE);

    expect({ code, error: printedError() }).toEqual({
      code: 1,
      error: "cyberzavod: --lang has no value: give a language, for example --lang en",
    });
  });

  it.each([
    [
      "по переменной окружения",
      ["status"],
      { CYBERZAVOD_LANG: "ru" },
      (root: string) =>
        `cyberzavod status: ${root} не в проекте Cyberzavod: сначала cyberzavod init`,
    ],
    [
      "по флагу поверх переменной",
      ["status", "--lang", "en"],
      { CYBERZAVOD_LANG: "ru" },
      (root: string) =>
        `cyberzavod status: ${root} is not in a Cyberzavod project: run cyberzavod init first`,
    ],
  ])("ошибка команды печатается на выбранном языке %s", async (_name, argv, env, expected) => {
    await runCli(argv, root, env);

    expect(printedError()).toBe(expected(root));
  });

  it.each([
    ["без русской локали — английское сообщение агенту", {}, "The config"],
    ["с русской локалью — русское сообщение агенту", { LANG: "ru_RU.UTF-8" }, "Конфиг"],
  ])("хук stop %s", async (_name, locale, start) => {
    await mkdir(path.join(root, ".cyberzavod"));
    await writeFile(path.join(root, PROJECT_CONFIG_FILE), "{ broken");
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdinWith({ session_id: SESSION_ID }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["hook", "stop"], root, { ...locale, CLAUDE_PROJECT_DIR: root });

    const [written] = stdout.mock.calls[0] ?? [];
    const { systemMessage } = JSON.parse(String(written)) as { systemMessage: string };

    expect(systemMessage.startsWith(start)).toBe(true);
  });

  it("справка называет команды публикации", async () => {
    await runCli([], root, NO_LOCALE);

    const help = printedLog();

    expect(
      ["login", "logout", "share", "unshare", "gallery"].map((name) =>
        help.includes(`cyberzavod ${name}`),
      ),
    ).toEqual([true, true, true, true, true]);
  });

  it("share и unshare без id выходят с ошибкой до обращения в сеть", async () => {
    const codes = await Promise.all([
      runCli(["share"], root, NO_LOCALE),
      runCli(["unshare"], root, NO_LOCALE),
    ]);

    expect(codes).toEqual([1, 1]);
  });

  it("gallery с --public и --private вместе выходит с ошибкой", async () => {
    const code = await runCli(["gallery", "--public", "--private"], root, NO_LOCALE);

    expect(code).toBe(1);
  });

  it("init --yes пишет конфиг, AGENTS.md и тонкий CLAUDE.md", async () => {
    const code = await runCli(["init", "--yes"], root, NO_LOCALE);

    const configText = await readFile(path.join(root, PROJECT_CONFIG_FILE), "utf8");
    const config = parseProjectConfig(JSON.parse(configText));
    const rules = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const entrypoint = await readFile(path.join(root, "CLAUDE.md"), "utf8");

    expect({
      code,
      projectId: config.projectId,
      commands: config.verification.commands,
      rules: rules.includes("`npm run test`"),
      imports: entrypoint.includes("@AGENTS.md"),
    }).toEqual({
      code: 0,
      projectId: "shop",
      commands: ["npm run test"],
      rules: true,
      imports: true,
    });
  });

  it("init кладёт в проект собранный CLI и прячет от git сырые журналы", async () => {
    await runCli(["init", "--yes"], root, NO_LOCALE);

    const tool = await readFile(path.join(root, TOOL_FILE), "utf8");
    const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");

    expect({ tool, gitignore }).toEqual({
      tool: BUILT_TOOL,
      gitignore: "/.cyberzavod/journal/capture/\n",
    });
  });

  it("переносит написанный человеком CLAUDE.md в AGENTS.md", async () => {
    await writeFile(path.join(root, "CLAUDE.md"), "# Мои правила\n");

    await runCli(["init", "--yes"], root, NO_LOCALE);

    const rules = await readFile(path.join(root, "AGENTS.md"), "utf8");

    expect(rules).toBe("# Мои правила\n");
  });

  it("второй init отказывает", async () => {
    await initialized();

    const code = await runCli(["init", "--yes"], root, NO_LOCALE);

    expect(code).toBe(1);
  });

  it("sync --check после init не находит расхождений, а после правки — находит", async () => {
    await initialized();
    const clean = await runCli(["sync", "--check"], root, NO_LOCALE);

    await writeFile(path.join(root, ".claude/agents/coder.md"), "правка\n");

    const stale = await runCli(["sync", "--check"], root, NO_LOCALE);

    expect([clean, stale]).toEqual([0, 1]);
  });

  it("sync восстанавливает сгенерированные файлы", async () => {
    await initialized();
    await rm(path.join(root, ".claude/agents/coder.md"));

    await runCli(["sync"], root, NO_LOCALE);

    const code = await runCli(["sync", "--check"], root, NO_LOCALE);

    expect(code).toBe(0);
  });

  it("decision и note пишут записи в журнал проекта", async () => {
    await initialized();

    const codes = [
      await runCli(
        ["decision", "Храним", "журнал", "рядом", "--why", "Чистый репозиторий"],
        root,
        NO_LOCALE,
      ),
      await runCli(["note", "Первая заметка"], root, NO_LOCALE),
    ];

    const decisions = await journalFiles("decisions");
    const notes = await journalFiles("notes");

    expect({ codes, decisions: decisions.length, notes: notes.length }).toEqual({
      codes: [0, 0],
      decisions: 1,
      notes: 1,
    });
  });

  it("decision без текста выходит с ошибкой", async () => {
    await initialized();

    const code = await runCli(["decision"], root, NO_LOCALE);

    expect(code).toBe(1);
  });

  it("команды проекта вне проекта выходят с ошибкой", async () => {
    const codes = await Promise.all(
      ["status", "note", "sync"].map((name) => runCli([name, "x"], root, NO_LOCALE)),
    );

    expect(codes).toEqual([1, 1, 1]);
  });

  it("неизвестный флаг — ошибка, а не падение", async () => {
    const code = await runCli(["sync", "--nope"], root, NO_LOCALE);

    expect(code).toBe(1);
  });

  it("status описывает подключённый проект", async () => {
    await initialized();

    const code = await runCli(["status"], root, NO_LOCALE);

    expect(code).toBe(0);
  });
});
