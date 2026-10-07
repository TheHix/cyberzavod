import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { CommandError } from "../errors.ts";
import {
  credentialsFile,
  FileCredentialsStore,
  settingsDirectory,
  type SettingsEnvironment,
} from "./settings.ts";

function environment(patch: Partial<SettingsEnvironment> = {}): SettingsEnvironment {
  return { env: {}, platform: "linux", homeDirectory: "/home/alice", ...patch };
}

async function temporaryStore(): Promise<{ store: FileCredentialsStore; file: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), "cyberzavod-credentials-"));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  const file = path.join(directory, "cyberzavod", "credentials.json");

  return { store: new FileCredentialsStore(file), file };
}

describe("settingsDirectory", () => {
  it("берёт XDG_CONFIG_HOME, если он задан", () => {
    const directory = settingsDirectory(environment({ env: { XDG_CONFIG_HOME: "/etc/xdg" } }));

    expect(directory).toBe("/etc/xdg/cyberzavod");
  });

  it("без XDG_CONFIG_HOME берёт ~/.config", () => {
    const directory = settingsDirectory(environment());

    expect(directory).toBe("/home/alice/.config/cyberzavod");
  });

  it("пустой XDG_CONFIG_HOME считает незаданным", () => {
    const directory = settingsDirectory(environment({ env: { XDG_CONFIG_HOME: "" } }));

    expect(directory).toBe("/home/alice/.config/cyberzavod");
  });

  it("на macOS тоже ~/.config", () => {
    const directory = settingsDirectory(environment({ platform: "darwin" }));

    expect(directory).toBe("/home/alice/.config/cyberzavod");
  });

  it("на Windows берёт APPDATA", () => {
    const directory = settingsDirectory(
      environment({
        platform: "win32",
        env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" },
        homeDirectory: "C:\\Users\\alice",
      }),
    );

    expect(directory).toBe("C:\\Users\\alice\\AppData\\Roaming\\cyberzavod");
  });

  it("на Windows без APPDATA берёт AppData\\Roaming домашнего каталога", () => {
    const directory = settingsDirectory(
      environment({ platform: "win32", homeDirectory: "C:\\Users\\alice" }),
    );

    expect(directory).toBe("C:\\Users\\alice\\AppData\\Roaming\\cyberzavod");
  });
});

describe("credentialsFile", () => {
  it("кладёт credentials.json в каталог настроек", () => {
    const file = credentialsFile(environment());

    expect(file).toBe("/home/alice/.config/cyberzavod/credentials.json");
  });
});

describe("FileCredentialsStore", () => {
  it("без файла говорит, что входа не было", async () => {
    const { store } = await temporaryStore();

    const token = await store.read();

    expect(token).toBeUndefined();
  });

  it("сохраняет токен и читает его обратно", async () => {
    const { store } = await temporaryStore();

    await store.save("token-1");

    const token = await store.read();

    expect(token).toBe("token-1");
  });

  it.skipIf(process.platform === "win32")("пишет файл с правами 600", async () => {
    const { store, file } = await temporaryStore();

    await store.save("token-1");

    const { mode } = await stat(file);

    expect(mode & 0o777).toBe(0o600);
  });

  it.skipIf(process.platform === "win32")("сужает права уже существующего файла", async () => {
    const { store, file } = await temporaryStore();

    await store.save("token-1");
    await writeFile(file, await readFile(file), { mode: 0o644 });

    await store.save("token-2");

    const { mode } = await stat(file);

    expect(mode & 0o777).toBe(0o600);
  });

  it("повреждённый файл — ошибка команды без токена в тексте", async () => {
    const { store, file } = await temporaryStore();

    await store.save("token-1");
    await writeFile(file, '{"token": 5}');

    const act = () => store.read();

    await expect(act()).rejects.toThrow(CommandError);
    await expect(act()).rejects.toThrow(/cyberzavod login/);
  });

  it("remove удаляет токен и сообщает, был ли он", async () => {
    const { store } = await temporaryStore();

    await store.save("token-1");

    const first = await store.remove();
    const second = await store.remove();

    expect({ first, second, token: await store.read() }).toEqual({
      first: true,
      second: false,
      token: undefined,
    });
  });
});
