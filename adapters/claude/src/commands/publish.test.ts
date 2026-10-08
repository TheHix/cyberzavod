import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { FIRST_BUILD_ID, interleavedDraft } from "../capture/draft.fixtures.ts";
import type { Draft } from "../capture/draft.ts";
import { ClaudeError } from "../errors.ts";
import { CLAUDE_MESSAGES } from "../messages/catalog.ts";
import { publishSessions } from "./publish.ts";

const JOURNAL = ".cyberzavod/journal";
const DRAFTS = path.join(JOURNAL, "capture/claude/drafts");

let root: string;

async function connectProject(): Promise<void> {
  const config = { projectId: "lab", harness: "0.4.0", workflow: "default", journal: JOURNAL };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

async function saveDraft(draft: Draft): Promise<void> {
  await mkdir(path.join(root, DRAFTS), { recursive: true });
  await writeFile(path.join(root, DRAFTS, `${draft.id}.json`), JSON.stringify(draft));
}

function printed(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.join("\n");
}

describe("publishSessions", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-publish-"));
    await connectProject();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("публикует выбранную сборку записью в журнал и сообщает об этом", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await saveDraft(interleavedDraft());

    const isPublished = await publishSessions({
      projectDirectory: root,
      buildId: FIRST_BUILD_ID,
      messages: CLAUDE_MESSAGES.en,
    });

    expect({
      isPublished,
      files: await readdir(path.join(root, JOURNAL, "sessions")),
      output: printed(log),
    }).toEqual({
      isPublished: true,
      files: [`${FIRST_BUILD_ID}.json`],
      output: expect.stringContaining("published: ") as string,
    });
  });

  it("не публикует сборку с утечкой и называет её на языке сообщений", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const draft = interleavedDraft();

    draft.builds = draft.builds.map((build) =>
      build.id === FIRST_BUILD_ID ? { ...build, title: "Сервер 203.0.113.7" } : build,
    );
    await saveDraft(draft);

    const isPublished = await publishSessions({
      projectDirectory: root,
      buildId: FIRST_BUILD_ID,
      messages: CLAUDE_MESSAGES.ru,
    });

    expect({ isPublished, output: printed(error) }).toEqual({
      isPublished: false,
      output: expect.stringMatching(
        /не готов к публикации[\s\S]*IP-адрес в «Сервер 203\.0\.113\.7»/,
      ) as string,
    });
  });

  it("неизвестная сборка — черновик не готов, а не исключение", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await saveDraft(interleavedDraft());

    const isPublished = await publishSessions({
      projectDirectory: root,
      buildId: "no-such-build",
      messages: CLAUDE_MESSAGES.en,
    });

    expect({ isPublished, output: printed(error) }).toEqual({
      isPublished: false,
      output: expect.stringContaining("the draft has no build no-such-build") as string,
    });
  });

  it("без черновиков — ошибка адаптера с подсказкой", async () => {
    const act = () => publishSessions({ projectDirectory: root, messages: CLAUDE_MESSAGES.en });

    await expect(act()).rejects.toThrow(ClaudeError);
    await expect(act()).rejects.toThrow("no drafts yet: run npx cyberzavod draft first");
  });

  it("вне проекта — ошибка адаптера", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "cyberzavod-outside-"));

    const act = () => publishSessions({ projectDirectory: outside, messages: CLAUDE_MESSAGES.en });

    await expect(act()).rejects.toThrow(/is not in a Cyberzavod project/);
    await rm(outside, { recursive: true, force: true });
  });
});
