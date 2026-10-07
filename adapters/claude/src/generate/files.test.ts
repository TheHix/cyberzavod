import { describe, expect, it } from "vitest";
import type { Harness, StageGuide } from "@cyberzavod/core";
import { claudeFiles, GENERATED_MARK, renderTemplate, type ClaudeProject } from "./files.ts";

function guide(stage: StageGuide["stage"], title: string, role?: string): StageGuide {
  const base = { stage, title, description: `${title}.`, body: `Текст этапа ${title}.` };
  return role === undefined ? base : { ...base, role: { name: role, access: "read" } };
}

function harness(): Harness {
  return {
    principles: [{ name: "safety", text: "## Безопасность\n\nБез секретов." }],
    stages: {
      planning: guide("planning", "Постановка", "analyst"),
      implementation: guide("implementation", "Код", "coder"),
      review: guide("review", "Ревью", "reviewer"),
      verification: guide("verification", "Проверки", "tester"),
      record: guide("record", "Фиксация"),
    },
    workflows: [],
    conductor: "Правила ведущего.",
  };
}

function claudeProject(): ClaudeProject {
  return {
    config: {
      projectId: "lab",
      harness: "0.3.0",
      workflow: "default",
      journal: "journal",
      agents: { implementation: { model: "opus" } },
      verification: { commands: ["pnpm test"], paths: [] },
    },
    harness: harness(),
    workflow: { name: "default", stages: ["planning", "implementation", "record"] },
    rules: ["", "apps/web"],
    capture: { raw: "journal/capture/claude/raw", drafts: "journal/capture/claude/drafts" },
    cli: "cyberzavod",
    templates: { publishRecording: "{{generated}}\n{{cli}} draft", recordingEditor: "{{drafts}}" },
  };
}

function fileOf(project: ClaudeProject, filePath: string): string {
  const file = claudeFiles(project).find(({ path }) => path === filePath);
  if (file === undefined) throw new Error(`нет файла ${filePath}`);
  return file.content;
}

describe("claudeFiles", () => {
  it("пишет CLAUDE.md рядом с каждым AGENTS.md, агентов ролей процесса и скиллы", () => {
    const project = claudeProject();

    const paths = claudeFiles(project).map(({ path }) => path);

    expect(paths).toEqual([
      "CLAUDE.md",
      "apps/web/CLAUDE.md",
      ".claude/agents/analyst.md",
      ".claude/agents/coder.md",
      ".claude/skills/feature/SKILL.md",
      ".claude/skills/publish-recording/SKILL.md",
      ".claude/agents/recording-editor.md",
    ]);
  });

  it("корневой CLAUDE.md несёт отметку, маршрут, проверки, принципы и импорт AGENTS.md", () => {
    const project = claudeProject();

    const content = fileOf(project, "CLAUDE.md");

    expect([
      content.includes(GENERATED_MARK),
      content.includes("Постановка → Код → Фиксация"),
      content.includes("- `pnpm test`"),
      content.includes("## Безопасность"),
      content.trimEnd().endsWith("@AGENTS.md"),
    ]).toEqual([true, true, true, true, true]);
  });

  it("вложенный CLAUDE.md только импортирует AGENTS.md", () => {
    const project = claudeProject();

    const content = fileOf(project, "apps/web/CLAUDE.md");

    expect(content.trimEnd().split("\n").at(-1)).toBe("@AGENTS.md");
  });

  it("берёт модель роли из конфига, а без неё — по умолчанию адаптера", () => {
    const project = claudeProject();

    const models = ["analyst", "coder"].map(
      (role) => /model: (\S+)/.exec(fileOf(project, `.claude/agents/${role}.md`))?.[1],
    );

    expect(models).toEqual(["opus", "opus"]);
  });

  it("кладёт в скилл процесса текст этапа без роли", () => {
    const project = claudeProject();

    const content = fileOf(project, ".claude/skills/feature/SKILL.md");

    expect(content).toContain("## Этап «Фиксация»\n\nТекст этапа Фиксация.");
  });
});

describe("renderTemplate", () => {
  it("подставляет команду CLI и каталоги журнала", () => {
    const project = claudeProject();

    const text = renderTemplate("{{cli}} draft {{raw}} {{drafts}}", project);

    expect(text).toBe("cyberzavod draft journal/capture/claude/raw journal/capture/claude/drafts");
  });

  it("отклоняет неизвестную подстановку", () => {
    const act = () => renderTemplate("{{secret}}", claudeProject());

    expect(act).toThrow(/\{\{secret\}\}/);
  });
});
