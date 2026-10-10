import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { GENERATED_MARK } from "@cyberzavod/adapter-kit";
import type { Harness, StageGuide } from "@cyberzavod/core";
import { CodexGenerateError } from "./codex.ts";
import { CONFIG_FILE, codexFiles, type CodexProject } from "./files.ts";

function guide(stage: StageGuide["stage"], title: string, role?: string): StageGuide {
  const base = { stage, title, description: `${title}.`, body: `Stage text ${title}.` };

  return role === undefined ? base : { ...base, role: { name: role, access: "read" } };
}

function harness(): Harness {
  return {
    principles: [{ name: "safety", text: "## Safety\n\nNo secrets." }],
    stages: {
      planning: guide("planning", "Plan", "analyst"),
      implementation: guide("implementation", "Code", "coder"),
      review: guide("review", "Review", "reviewer"),
      verification: guide("verification", "Verify", "tester"),
      record: guide("record", "Record"),
    },
    workflows: [],
    conductor: "Lead rules.",
  };
}

function codexProject(): CodexProject {
  return {
    config: {
      projectId: "lab",
      harness: "0.3.0",
      workflow: "default",
      journal: "journal",
      agents: {},
      verification: { commands: ["pnpm test"], paths: [] },
    },
    harness: harness(),
    workflow: { name: "default", stages: ["planning", "implementation", "record"] },
    capture: { raw: "journal/capture/codex/raw", drafts: "journal/capture/codex/drafts" },
    cli: "npx cyberzavod@0.3.0",
    templates: { setup: "---\nname: setup\n---\n{{generated}}\n{{cli}} sync" },
  };
}

function fileOf(project: CodexProject, filePath: string): string {
  const file = codexFiles(project).find(({ path }) => path === filePath);

  if (file === undefined) throw new Error(`нет файла ${filePath}`);

  return file.content;
}

describe("codexFiles", () => {
  it("пишет config.toml, роли процесса, оба скилла и их политику вызова", () => {
    const paths = codexFiles(codexProject()).map(({ path }) => path);

    expect(paths).toEqual([
      ".codex/config.toml",
      ".codex/agents/analyst.toml",
      ".codex/agents/coder.toml",
      ".agents/skills/feature/SKILL.md",
      ".agents/skills/feature/agents/openai.yaml",
      ".agents/skills/setup/SKILL.md",
      ".agents/skills/setup/agents/openai.yaml",
    ]);
  });

  it("не кладёт файлов рядом с AGENTS.md и корневого AGENTS.override.md", () => {
    const paths = codexFiles(codexProject()).map(({ path }) => path);

    expect(paths.some((path) => path.includes("AGENTS") || path.endsWith("CLAUDE.md"))).toBe(false);
  });

  it("каждый TOML-файл разбирается настоящим парсером", () => {
    const tomlFiles = codexFiles(codexProject()).filter(({ path }) => path.endsWith(".toml"));

    const parsed = tomlFiles.map(({ content }) => parse(content));

    expect(parsed).toHaveLength(3);
  });

  it("config.toml несёт отметку, бюджет документов и правила работы с принципами", () => {
    const config = parse(fileOf(codexProject(), CONFIG_FILE));

    expect(fileOf(codexProject(), CONFIG_FILE)).toContain(GENERATED_MARK);
    expect(config.project_doc_max_bytes).toBe(262144);
    expect(config.developer_instructions).toEqual(expect.stringContaining("## Safety"));
    expect(config.developer_instructions).toEqual(expect.stringContaining("`pnpm test`"));
    expect(config.developer_instructions).toEqual(expect.stringContaining("$feature <task>"));
  });

  it("роль несёт те же правила работы, текст своего этапа и модель этапа", () => {
    const project = codexProject();
    const rules = parse(fileOf(project, CONFIG_FILE)).developer_instructions as string;

    const role = parse(fileOf(project, ".codex/agents/coder.toml"));

    expect(role).toMatchObject({
      name: "coder",
      model: "gpt-6.1-sol",
      model_reasoning_effort: "high",
    });
    expect(role.developer_instructions).toEqual(expect.stringContaining(rules));
    expect(role.developer_instructions).toEqual(expect.stringContaining("Stage text Code."));
  });

  it("берёт модель этапа из конфига", () => {
    const project = codexProject();
    const configured: CodexProject = {
      ...project,
      config: { ...project.config, agents: { planning: { model: "gpt-custom" } } },
    };

    const role = parse(fileOf(configured, ".codex/agents/analyst.toml"));

    expect(role.model).toBe("gpt-custom");
  });

  it("скилл feature несёт таблицу этапов, правила ведущего и способ вызова станции", () => {
    const skill = fileOf(codexProject(), ".agents/skills/feature/SKILL.md");

    expect(skill).toContain("name: feature");
    expect(skill).toContain("Lead rules.");
    expect(skill).toContain("`spawn_agent`");
    expect(skill).toContain("`wait_agent`");
    expect(skill).toContain("`unknown agent_type`");
    expect(skill).toContain("gpt-6-astra");
    expect(skill).toContain("`$ARGUMENTS`");
    expect(skill).toContain(GENERATED_MARK);
  });

  it("скилл feature называет роли и тексты этапов без роли", () => {
    const skill = fileOf(codexProject(), ".agents/skills/feature/SKILL.md");

    expect(skill).toContain("analyst");
    expect(skill).toContain("Stage text Record.");
  });

  it("отключает неявный вызов скиллов", () => {
    const policy = fileOf(codexProject(), ".agents/skills/feature/agents/openai.yaml");

    expect(policy).toContain("allow_implicit_invocation: false");
  });

  it("скилл setup собирается из шаблона с подстановками", () => {
    const skill = fileOf(codexProject(), ".agents/skills/setup/SKILL.md");

    expect(skill).toContain(GENERATED_MARK);
    expect(skill).toContain("npx cyberzavod@0.3.0 sync");
  });

  it("отвергает этап, отданный другому агенту", () => {
    const project = codexProject();
    const other: CodexProject = {
      ...project,
      config: {
        ...project.config,
        agents: { planning: { provider: "anthropic", agent: "claude" } },
      },
    };

    const act = () => codexFiles(other);

    expect(act).toThrow(CodexGenerateError);
  });
});
