// Файлы Claude Code проекта, собранные из harness и конфига проекта: тонкие CLAUDE.md поверх
// AGENTS.md, агенты ролей, скиллы процесса и публикации записи. Здесь — только тексты; что
// с ними делать на диске, решает sync.ts.

import type { Harness, ProjectConfig, StageGuide, StageRole, Workflow } from "@cyberzavod/core";
import {
  claudeEffortOf,
  claudeModelOf,
  claudeToolsOf,
  ESCALATION_MODEL,
  GenerateError,
} from "./claude.ts";

/** Отметка сгенерированного файла: такой файл sync перезаписывает и удаляет сам. */
export const GENERATED_MARK = "Сгенерировано `cyberzavod sync`";

const GENERATED_COMMENT = `<!-- ${GENERATED_MARK} из harness и .cyberzavod/project.json: не править вручную. Правила проекта — в AGENTS.md. -->`;

/** Файл, который пишет генератор: путь от корня проекта через `/` и содержимое. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** Шаблоны адаптера: тексты, которые не выводятся из harness. */
export interface ClaudeTemplates {
  publishRecording: string;
  recordingEditor: string;
}

/** Всё, из чего собираются файлы Claude Code проекта. */
export interface ClaudeProject {
  config: ProjectConfig;
  harness: Harness;
  workflow: Workflow;
  /** Каталоги с AGENTS.md от корня проекта через `/`; корень — пустая строка. */
  rules: string[];
  /** Каталоги сырых журналов и черновиков адаптера от корня проекта через `/`. */
  capture: { raw: string; drafts: string };
  /** Как запустить CLI Cyberzavod из корня проекта. */
  cli: string;
  templates: ClaudeTemplates;
}

const RULES_FILE = "AGENTS.md";
const ENTRYPOINT_FILE = "CLAUDE.md";

function joinPath(directory: string, file: string): string {
  return directory === "" ? file : `${directory}/${file}`;
}

function stageGuidesOf(project: ClaudeProject): StageGuide[] {
  return project.workflow.stages.map((stage) => project.harness.stages[stage]);
}

function rootEntrypoint(project: ClaudeProject): string {
  const { config, harness } = project;
  const route = stageGuidesOf(project)
    .map(({ title }) => title)
    .join(" → ");
  const commands = config.verification.commands.map((command) => `- \`${command}\``);
  const verification =
    commands.length === 0
      ? "Проверки проекта не заданы: впиши их в `verification.commands` файла `.cyberzavod/project.json`."
      : `Проверки проекта (\`verification.commands\` в \`.cyberzavod/project.json\`) должны быть зелёными перед коммитом:\n\n${commands.join("\n")}`;

  return [
    GENERATED_COMMENT,
    "# Как работать в этом проекте",
    `Процесс разработки ведёт Cyberzavod (harness ${config.harness}, процесс \`${config.workflow}\`): ${route}. Задачу через весь процесс проводит \`/feature <задача>\`; роли этапов — агенты в \`.claude/agents/\`.`,
    verification,
    ...harness.principles.map(({ text }) => text),
    `@${RULES_FILE}`,
  ].join("\n\n");
}

function nestedEntrypoint(): string {
  return `${GENERATED_COMMENT}\n\n@${RULES_FILE}`;
}

function entrypoints(project: ClaudeProject): GeneratedFile[] {
  return project.rules.map((directory) => ({
    path: joinPath(directory, ENTRYPOINT_FILE),
    content: `${directory === "" ? rootEntrypoint(project) : nestedEntrypoint()}\n`,
  }));
}

function agentFile(guide: StageGuide, role: StageRole, model: string): GeneratedFile {
  const content = [
    "---",
    `name: ${role.name}`,
    `description: ${guide.description} Этап «${guide.title}» процесса /feature.`,
    `tools: ${claudeToolsOf(role.access)}`,
    `model: ${model}`,
    `effort: ${claudeEffortOf(guide.stage)}`,
    "---",
    GENERATED_COMMENT,
    "",
    guide.body,
    "",
  ].join("\n");

  return { path: `.claude/agents/${role.name}.md`, content };
}

function roleAgents(project: ClaudeProject): GeneratedFile[] {
  return stageGuidesOf(project).flatMap((guide) => {
    if (guide.role === undefined) return [];

    const model = claudeModelOf(guide.stage, project.config.agents[guide.stage]);

    return [agentFile(guide, guide.role, model)];
  });
}

function stageRow(guide: StageGuide, project: ClaudeProject): string {
  if (guide.role === undefined) return `| ${guide.title} | ведущий сам | — |`;

  const model = claudeModelOf(guide.stage, project.config.agents[guide.stage]);

  return `| ${guide.title} | \`${guide.role.name}\` | ${model} |`;
}

function featureFrontmatter(project: ClaudeProject, guides: readonly StageGuide[]): string {
  const route = guides.map(({ title }) => title.toLowerCase()).join(", ");

  return [
    "---",
    "name: feature",
    `description: Проводит задачу через процесс ${project.workflow.name} — ${route}; у каждой роли своя модель. Запуск — /feature <задача>.`,
    "argument-hint: <задача>",
    "disable-model-invocation: true",
    "---",
    GENERATED_COMMENT,
  ].join("\n");
}

function stageTable(project: ClaudeProject, guides: readonly StageGuide[]): string {
  return [
    "| Этап | Роль | Модель |",
    "| --- | --- | --- |",
    ...guides.map((guide) => stageRow(guide, project)),
  ].join("\n");
}

function featureSkill(project: ClaudeProject): GeneratedFile {
  const guides = stageGuidesOf(project);
  const ownStages = guides
    .filter((guide) => guide.role === undefined)
    .map((guide) => `## Этап «${guide.title}»\n\n${guide.body}`);
  const content = [
    featureFrontmatter(project, guides),
    "# Задача через процесс",
    stageTable(project, guides),
    project.harness.conductor,
    `Более сильная модель для второй доработки — \`${ESCALATION_MODEL}\`: передай \`model: "${ESCALATION_MODEL}"\` в вызове агента.`,
    ...ownStages,
  ].join("\n\n");

  return { path: ".claude/skills/feature/SKILL.md", content: `${content}\n` };
}

/**
 * Подставляет в шаблон адаптера отметку генерации, команду CLI и каталоги журнала.
 * @param {string} template Текст шаблона с `{{generated}}`, `{{cli}}`, `{{raw}}`, `{{drafts}}`.
 * @param {ClaudeProject} project Проект.
 * @returns {string} Готовый текст файла.
 * @throws {GenerateError} Если в шаблоне подстановка, которой адаптер не знает.
 */
export function renderTemplate(template: string, project: ClaudeProject): string {
  const values: Record<string, string> = {
    generated: GENERATED_COMMENT,
    cli: project.cli,
    raw: project.capture.raw,
    drafts: project.capture.drafts,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => {
    const value = values[name];

    if (value === undefined) {
      throw new GenerateError(`в шаблоне неизвестная подстановка ${placeholder}`);
    }

    return value;
  });
}

function recordingFiles(project: ClaudeProject): GeneratedFile[] {
  return [
    {
      path: ".claude/skills/publish-recording/SKILL.md",
      content: renderTemplate(project.templates.publishRecording, project),
    },
    {
      path: ".claude/agents/recording-editor.md",
      content: renderTemplate(project.templates.recordingEditor, project),
    },
  ];
}

/**
 * Собирает все файлы Claude Code проекта, кроме настроек.
 * @param {ClaudeProject} project Конфиг, harness, процесс, каталоги правил и шаблоны.
 * @returns {GeneratedFile[]} Файлы по путям от корня проекта.
 * @throws {GenerateError} Если этап отдан агенту, которого адаптер не ведёт.
 */
export function claudeFiles(project: ClaudeProject): GeneratedFile[] {
  return [
    ...entrypoints(project),
    ...roleAgents(project),
    featureSkill(project),
    ...recordingFiles(project),
  ];
}
