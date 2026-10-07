import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { temporaryDirectory, validConfig, validDecision, validSession } from "./fixtures.ts";
import { DirectoryRecordStore, JournalError, journalDirectory } from "./journal.ts";

describe("DirectoryRecordStore", () => {
  it("раскладывает записи по коллекциям типов", async () => {
    const directory = await temporaryDirectory();
    const store = new DirectoryRecordStore(directory);

    const paths = [store.pathOf(validSession()), store.pathOf(validDecision())];

    expect(paths).toEqual([
      path.join(directory, "sessions", "2026-10-07-demo.json"),
      path.join(directory, "decisions", "use-indexeddb.json"),
    ]);
  });

  it("перечисляет записанные записи", async () => {
    const store = new DirectoryRecordStore(await temporaryDirectory());

    await store.write(validSession());
    await store.write(validDecision());

    const records = await store.list();

    expect(records).toEqual([validSession(), validDecision()]);
  });

  it("у журнала без каталога записей нет", async () => {
    const directory = path.join(await temporaryDirectory(), "missing");
    const store = new DirectoryRecordStore(directory);

    const records = await store.list();

    expect(records).toEqual([]);
  });

  it("не читает рабочие файлы адаптеров как записи", async () => {
    const directory = await temporaryDirectory();

    await mkdir(path.join(directory, "capture", "drafts"), { recursive: true });
    await writeFile(path.join(directory, "capture", "drafts", "draft.json"), "{}");
    const store = new DirectoryRecordStore(directory);

    const records = await store.list();

    expect(records).toEqual([]);
  });

  it("называет битый файл записи", async () => {
    const directory = await temporaryDirectory();

    await mkdir(path.join(directory, "notes"));
    await writeFile(path.join(directory, "notes", "broken.json"), '{"version": 9}');
    const store = new DirectoryRecordStore(directory);

    const act = () => store.list();

    await expect(act()).rejects.toThrow(JournalError);
  });
});

describe("journalDirectory", () => {
  it.each([
    ["journal", ["journal"]],
    ["../demo.cyberzavod", ["..", "demo.cyberzavod"]],
  ])("разрешает «%s» от корня проекта", (journal, segments) => {
    const root = path.resolve("projects", "demo");

    const directory = journalDirectory(root, validConfig({ journal }));

    expect(directory).toBe(path.resolve(root, ...segments));
  });
});
