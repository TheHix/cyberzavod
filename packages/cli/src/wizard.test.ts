import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarness } from "@cyberzavod/storage";
import type { DetectedProject } from "./detect.ts";
import { HARNESS_DIRECTORY } from "./install.ts";
import { askProjectConfig, defaultsPrompter, describeDetected, type Prompter } from "./wizard.ts";

const ROOT = path.join(path.sep, "work", "shop");

function detected(): DetectedProject {
  return {
    name: "@acme/shop",
    languages: ["typescript"],
    frameworks: ["react"],
    packageManager: "pnpm",
    git: true,
    scripts: ["test"],
    verification: ["pnpm run lint", "pnpm run test"],
  };
}

// Отвечает по таблице «начало вопроса — ответ», на остальное — по умолчанию.
function scriptedPrompter(answers: Record<string, string>): Prompter {
  return {
    ask: (question, fallback) => {
      const key = Object.keys(answers).find((start) => question.startsWith(start));
      return Promise.resolve(key === undefined ? fallback : (answers[key] ?? fallback));
    },
    close: () => undefined,
  };
}

describe("askProjectConfig", () => {
  it("по умолчанию берёт найденное: имя, проверки, журнал рядом с проектом", async () => {
    const harness = await loadHarness(HARNESS_DIRECTORY);

    const config = await askProjectConfig(ROOT, detected(), harness, defaultsPrompter());

    expect({
      projectId: config.projectId,
      workflow: config.workflow,
      journal: config.journal,
      commands: config.verification.commands,
      stages: Object.keys(config.agents),
      stack: config.stack,
    }).toEqual({
      projectId: "acme-shop",
      workflow: "default",
      journal: "../shop.cyberzavod",
      commands: ["pnpm run lint", "pnpm run test"],
      stages: ["planning", "implementation", "review", "verification"],
      stack: { languages: ["typescript"], frameworks: ["react"], packageManager: "pnpm" },
    });
  });

  it("принимает ответы человека: модель этапа, журнал и команды через точку с запятой", async () => {
    const harness = await loadHarness(HARNESS_DIRECTORY);
    const prompter = scriptedPrompter({
      "Модель этапа «Код»": "opus",
      "Каталог журнала": "journal",
      "Команды проверки": "make check ;  ; make e2e",
    });

    const config = await askProjectConfig(ROOT, detected(), harness, prompter);

    expect({
      model: config.agents.implementation,
      journal: config.journal,
      commands: config.verification.commands,
    }).toEqual({
      model: { provider: "anthropic", agent: "claude", model: "opus" },
      journal: "journal",
      commands: ["make check", "make e2e"],
    });
  });

  it("отклоняет процесс, которого нет в harness", async () => {
    const harness = await loadHarness(HARNESS_DIRECTORY);

    const act = () =>
      askProjectConfig(ROOT, detected(), harness, scriptedPrompter({ Процесс: "waterfall" }));

    await expect(act).rejects.toThrow(/процесса waterfall нет/);
  });
});

describe("describeDetected", () => {
  it("называет и найденное, и ненайденное", () => {
    const project = { ...detected(), frameworks: [], git: false };

    const lines = describeDetected(ROOT, project);

    expect(lines.filter((line) => /не найдены|нет$/.test(line))).toEqual([
      "Фреймворки: не найдены",
      "Git: нет",
    ]);
  });
});
