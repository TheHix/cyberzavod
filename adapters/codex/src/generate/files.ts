// The project's Codex files, built from the harness and the project config: the working rules and
// the document budget in `.codex/config.toml`, role agents, workflow skills. Codex reads AGENTS.md
// itself, so unlike Claude Code there are no files next to it. Only the texts live here; sync.ts
// decides what to do with them on disk.

import {
  HASH_GENERATED_COMMENT,
  MARKDOWN_GENERATED_COMMENT,
  ownStageSections,
  renderTemplate,
  stageGuidesOf,
  stageTable,
  templateValues,
  workingRulesParagraphs,
  type GeneratedFile,
} from "@cyberzavod/adapter-kit";
import type { Harness, ProjectConfig, StageGuide, StageRole, Workflow } from "@cyberzavod/core";
import { codexEffortOf, codexModelOf, ESCALATION_MODEL, type CodexGenerateError } from "./codex.ts";
import { tomlMultilineString, tomlString } from "./toml.ts";

/** Adapter templates: texts that are not derived from the harness. */
export interface CodexTemplates {
  setup: string;
}

/** Everything the project's Codex files are built from. */
export interface CodexProject {
  config: ProjectConfig;
  harness: Harness;
  workflow: Workflow;
  /** Adapter directories of raw logs and drafts from the project root with `/`. */
  capture: { raw: string; drafts: string };
  /** How to run the Cyberzavod CLI from the project root. */
  cli: string;
  templates: CodexTemplates;
}

/** Path of the project config of Codex relative to the project root. */
export const CONFIG_FILE = ".codex/config.toml";

const AGENTS_DIRECTORY = ".codex/agents/";
const SKILLS_DIRECTORY = ".agents/skills";
const FEATURE_CALL = "$feature <task>";

// Codex reads at most 32 KiB of AGENTS.md files by default and silently cuts the rest, which is
// less than a large project's root rules file. 256 KiB leaves room for nested files too.
const PROJECT_DOC_MAX_BYTES = 262144;

const SKILL_POLICY = "policy:\n  allow_implicit_invocation: false";

function guidesOf(project: CodexProject): StageGuide[] {
  return stageGuidesOf(project.harness, project.workflow);
}

// Codex replaces the parent's `developer_instructions` in a role with the role's own, so every role
// carries the same working rules and then its own stage text.
function workingRules(project: CodexProject): string {
  const { config, harness, workflow } = project;
  const paragraphs = workingRulesParagraphs({
    config,
    harness,
    workflow,
    featureCall: FEATURE_CALL,
    agentsDirectory: AGENTS_DIRECTORY,
  });

  return paragraphs.join("\n\n");
}

function configFile(project: CodexProject): GeneratedFile {
  const content = [
    HASH_GENERATED_COMMENT,
    `project_doc_max_bytes = ${PROJECT_DOC_MAX_BYTES}`,
    `developer_instructions = ${tomlMultilineString(workingRules(project))}`,
  ].join("\n");

  return { path: CONFIG_FILE, content: `${content}\n` };
}

function roleFile(project: CodexProject, guide: StageGuide, role: StageRole): GeneratedFile {
  const model = codexModelOf(guide.stage, project.config.agents[guide.stage]);
  const instructions = `${workingRules(project)}\n\n${guide.body}`;
  const description = `${guide.description} The "${guide.title}" stage of $feature.`;
  const content = [
    HASH_GENERATED_COMMENT,
    `name = ${tomlString(role.name)}`,
    `description = ${tomlString(description)}`,
    `model = ${tomlString(model)}`,
    `model_reasoning_effort = ${tomlString(codexEffortOf(guide.stage))}`,
    `developer_instructions = ${tomlMultilineString(instructions)}`,
  ].join("\n");

  return { path: `${AGENTS_DIRECTORY}${role.name}.toml`, content: `${content}\n` };
}

function roleFiles(project: CodexProject): GeneratedFile[] {
  return guidesOf(project).flatMap((guide) => {
    if (guide.role === undefined) return [];

    return [roleFile(project, guide, guide.role)];
  });
}

function featureFrontmatter(project: CodexProject, guides: readonly StageGuide[]): string {
  const route = guides.map(({ title }) => title.toLowerCase()).join(", ");

  return [
    "---",
    "name: feature",
    `description: Runs a task through the ${project.workflow.name} workflow — ${route}; each role has its own model. Usage: $feature <task>.`,
    "---",
    MARKDOWN_GENERATED_COMMENT,
  ].join("\n");
}

function stageCallText(project: CodexProject): string {
  return [
    "## How to call a stage in Codex",
    "Call a stage with the `spawn_agent` tool: pass `agent_type` with the role name from the table and the whole assignment in `message`, then wait for the result with `wait_agent`. If `spawn_agent` is not in your tool list, find it with tool search (it lives in the `multi_agent_v1` namespace).",
    `If the call fails with \`unknown agent_type\`, the project is not trusted in Codex yet: stop, tell the human and name \`${project.cli} doctor\`.`,
    `Stronger model for the second rework — \`${ESCALATION_MODEL}\`: pass \`model: "${ESCALATION_MODEL}"\` in the spawn_agent call.`,
  ].join("\n\n");
}

function featureSkill(project: CodexProject): GeneratedFile {
  const guides = guidesOf(project);
  const modelOf = (guide: StageGuide) =>
    codexModelOf(guide.stage, project.config.agents[guide.stage]);
  const content = [
    featureFrontmatter(project, guides),
    "# A task through the workflow",
    stageTable(guides, modelOf),
    "`$ARGUMENTS` below is the text the human wrote after `$feature`.",
    project.harness.conductor,
    stageCallText(project),
    ...ownStageSections(guides),
  ].join("\n\n");

  return { path: `${SKILLS_DIRECTORY}/feature/SKILL.md`, content: `${content}\n` };
}

function setupSkill(project: CodexProject): GeneratedFile {
  return {
    path: `${SKILLS_DIRECTORY}/setup/SKILL.md`,
    content: renderTemplate(project.templates.setup, templateValues(project)),
  };
}

// The skills are for the human to call: the model does not pick them on its own.
function skillPolicy(skill: string): GeneratedFile {
  return {
    path: `${SKILLS_DIRECTORY}/${skill}/agents/openai.yaml`,
    content: `${HASH_GENERATED_COMMENT}\n${SKILL_POLICY}\n`,
  };
}

/**
 * Builds all of the project's Codex files except the hooks file.
 * @param {CodexProject} project Config, harness, workflow and templates.
 * @returns {GeneratedFile[]} Files by path from the project root.
 * @throws {CodexGenerateError} If a stage is assigned to an agent this adapter does not run.
 */
export function codexFiles(project: CodexProject): GeneratedFile[] {
  return [
    configFile(project),
    ...roleFiles(project),
    featureSkill(project),
    skillPolicy("feature"),
    setupSkill(project),
    skillPolicy("setup"),
  ];
}
